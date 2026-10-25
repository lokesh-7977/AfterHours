import "server-only";
import sharp from "sharp";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { getEnv, isR2Configured } from "@/lib/env";
import { randomHex } from "@/lib/crypto";
import { errors } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { logger } from "@/lib/logger";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { withTransaction } from "@/lib/transactions";
import { optionalTrimmed, parseInput, optionalBlank } from "@/lib/validation";
import { getStorage } from "@/infrastructure/storage/r2-storage.service";
import { detectMimeFromSignature, isSignatureCompatible, parseIsoBmffDuration, sanitizeFilename } from "@/infrastructure/storage/media-validation";
import { assertAdmin, assertAuthenticated } from "@/modules/auth/policies";
import { isAdminRole, type SessionUser } from "@/modules/auth/roles";
import { recordAudit, recordAuditSafe } from "@/modules/audit/audit.service";
import { eventRepository } from "@/modules/events/event.repository";
import { isPubliclyVisible } from "@/modules/events/event.policy";
import { EventModel, type EventDoc } from "@/modules/events/event.model";
import { isVerifiedAttendee } from "@/modules/attendance/attendance.service";
import { RegistrationModel } from "@/modules/registrations/registration.model";
import { notify } from "@/modules/notifications/notification.service";
import { getUserSummaries } from "@/modules/users/user.service";
import {
  ALLOWED_MIME_TYPES,
  MEDIA_PURPOSES,
  MIME_EXTENSIONS,
  MULTIPART_PART_SIZE_BYTES,
  MULTIPART_THRESHOLD_BYTES,
  mediaTypeForMime,
  type AllowedMimeType,
  type MediaPurpose,
  type MediaType,
  type ModerationStatus,
  type ProcessingStatus,
} from "./media.constants";
import { EventMediaModel, type EventMediaDoc } from "./media.model";
import { canUploadPurpose, initialModerationStatus, mediaReadAccess, type MediaAccess } from "./media.policy";

const UPLOAD_URL_TTL_SECONDS = 15 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 60;
const MAX_PAYMENT_PROOF_BYTES = 10 * 1024 * 1024;
const MAX_PROOFS_PER_REGISTRATION = 5;
const THUMBNAIL_WIDTH = 640;

// ---------------------------------------------------------------- DTOs

export interface MediaDTO {
  id: string;
  eventId: string;
  purpose: MediaPurpose;
  mediaType: MediaType;
  mimeType: string;
  sizeBytes: number | null;
  filename: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  processingStatus: ProcessingStatus;
  moderationStatus: ModerationStatus;
  moderationReason: string | null;
  isOwn: boolean;
  contentUrl: string;
  thumbnailUrl: string | null;
  uploader: { id: string; name: string } | null;
  createdAt: string;
}

function toMediaDTO(m: EventMediaDoc, actorId: string | null, uploaderName?: string): MediaDTO {
  const base = `/api/v1/media/${m._id}/content`;
  return {
    id: m._id,
    eventId: m.eventId,
    purpose: m.purpose,
    mediaType: m.mediaType,
    mimeType: m.mimeType,
    sizeBytes: m.sizeBytes,
    filename: m.originalFilename,
    width: m.width,
    height: m.height,
    durationSeconds: m.durationSeconds,
    processingStatus: m.processingStatus,
    moderationStatus: m.moderationStatus,
    moderationReason: actorId === m.uploaderId ? m.moderationReason : null,
    isOwn: actorId === m.uploaderId,
    contentUrl: base,
    thumbnailUrl: m.thumbnailKey ? `${base}?variant=thumbnail` : null,
    uploader: uploaderName !== undefined ? { id: m.uploaderId, name: uploaderName } : null,
    createdAt: m.createdAt.toISOString(),
  };
}

// ---------------------------------------------------------------- upload initiation

export const requestUploadSchema = z.object({
  eventId: z.uuid(),
  purpose: z.enum(MEDIA_PURPOSES),
  filename: z.string().trim().min(1).max(200),
  contentType: z.enum(ALLOWED_MIME_TYPES, { message: "Unsupported file type. Allowed: JPEG, PNG, WebP, AVIF, MP4, WebM, MOV" }),
  size: z.coerce.number().int().min(1),
  registrationId: z.uuid().optional(),
});

export type UploadInstructions =
  | { mediaId: string; strategy: "single"; uploadUrl: string; headers: Record<string, string>; expiresInSeconds: number }
  | { mediaId: string; strategy: "multipart"; partSize: number; partCount: number; expiresInSeconds: number };

function maxBytesFor(type: MediaType, purpose: MediaPurpose): number {
  const env = getEnv();
  if (purpose === "payment_proof") return MAX_PAYMENT_PROOF_BYTES;
  return type === "image" ? env.MEDIA_MAX_IMAGE_BYTES : env.MEDIA_MAX_VIDEO_BYTES;
}

/** Authorization for writing media of `purpose` into `event` (re-run at every upload step). */
async function assertCanWrite(actor: SessionUser, event: EventDoc, purpose: MediaPurpose, registrationId: string | null): Promise<void> {
  if (!canUploadPurpose(actor.role, purpose)) throw errors.forbidden("You cannot upload this kind of media");
  if (purpose === "gallery") {
    if (!event.gallerySettings?.enabled) throw errors.forbidden("The gallery is disabled for this event");
    if (!isAdminRole(actor.role)) {
      if (!event.gallerySettings?.uploadsEnabled) throw errors.forbidden("Uploads are closed for this gallery");
      if (!(await isVerifiedAttendee(actor.id, event._id))) throw errors.forbidden("Only verified attendees can upload to this gallery");
    }
  }
  if (purpose === "payment_proof") {
    const reg = registrationId ? await RegistrationModel.findOne({ _id: registrationId, userId: actor.id, eventId: event._id }).lean() : null;
    if (!reg) throw errors.forbidden("Payment proof must belong to your registration");
    if (reg.status !== "registered" || !["pending", "submitted", "rejected"].includes(reg.paymentStatus)) {
      throw errors.conflict("This registration does not accept payment proof", "INVALID_STATE");
    }
  }
}

async function assertQuota(actor: SessionUser, event: EventDoc, purpose: MediaPurpose, registrationId: string | null) {
  if (purpose === "gallery" && !isAdminRole(actor.role)) {
    const max = event.gallerySettings?.maxUploadsPerUser ?? getEnv().MEDIA_DEFAULT_MAX_UPLOADS_PER_USER;
    const used = await EventMediaModel.countDocuments({ eventId: event._id, uploaderId: actor.id, purpose: "gallery", deletedAt: null, processingStatus: { $ne: "failed" } });
    if (used >= max) throw errors.conflict(`Upload limit reached (${max} per attendee)`, "QUOTA_EXCEEDED");
  }
  if (purpose === "payment_proof") {
    const used = await EventMediaModel.countDocuments({ registrationId, purpose: "payment_proof", deletedAt: null });
    if (used >= MAX_PROOFS_PER_REGISTRATION) throw errors.conflict("Too many payment proof uploads", "QUOTA_EXCEEDED");
  }
}

/**
 * Step 1 of the direct-to-R2 upload. The server picks the object key; the
 * client only receives a short-lived URL scoped to that exact key.
 */
export async function requestUpload(actor: SessionUser | null, rawInput: unknown): Promise<UploadInstructions> {
  assertAuthenticated(actor);
  const input = parseInput(requestUploadSchema, rawInput);
  await connectDB();
  await enforceRateLimit(`media:${actor.id}`, RATE_LIMITS.mediaOps);

  const mediaType = mediaTypeForMime(input.contentType)!;
  if (input.purpose !== "gallery" && mediaType !== "image") throw errors.unsupportedType("Only images are accepted for this upload");
  const maxBytes = maxBytesFor(mediaType, input.purpose);
  if (input.size > maxBytes) throw errors.tooLarge(`File too large (max ${Math.floor(maxBytes / 1024 / 1024)} MB)`);

  const event = await eventRepository.getOrThrow(input.eventId);
  const registrationId = input.purpose === "payment_proof" ? (input.registrationId ?? null) : null;
  await assertCanWrite(actor, event, input.purpose, registrationId);
  await assertQuota(actor, event, input.purpose, registrationId);

  // After validation/authorization, before creating any record: fail when there is nowhere to upload to.
  if (!isR2Configured()) throw errors.unavailable("Media storage is not configured");

  const mediaId = newId();
  const storageKey = `events/${event._id}/${input.purpose}/${mediaId}-${randomHex(8)}${MIME_EXTENSIONS[input.contentType]}`;
  const storage = getStorage();
  const multipart = input.size > MULTIPART_THRESHOLD_BYTES;
  const multipartUploadId = multipart ? await storage.createMultipartUpload(storageKey, input.contentType) : null;

  await EventMediaModel.create({
    _id: mediaId,
    eventId: event._id,
    uploaderId: actor.id,
    purpose: input.purpose,
    registrationId,
    storageKey,
    mediaType,
    mimeType: input.contentType,
    declaredSize: input.size,
    originalFilename: sanitizeFilename(input.filename),
    multipartUploadId,
    processingStatus: "pending",
    moderationStatus: "pending",
  });

  if (multipart) {
    return { mediaId, strategy: "multipart", partSize: MULTIPART_PART_SIZE_BYTES, partCount: Math.ceil(input.size / MULTIPART_PART_SIZE_BYTES), expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
  }
  const { url, headers } = await storage.presignPut(storageKey, { contentType: input.contentType, contentLength: input.size, expiresInSeconds: UPLOAD_URL_TTL_SECONDS });
  return { mediaId, strategy: "single", uploadUrl: url, headers, expiresInSeconds: UPLOAD_URL_TTL_SECONDS };
}

async function loadOwnPendingUpload(actor: SessionUser, mediaId: string): Promise<{ media: EventMediaDoc; event: EventDoc }> {
  const media = await EventMediaModel.findOne({ _id: mediaId, uploaderId: actor.id, deletedAt: null }).lean<EventMediaDoc>();
  if (!media) throw errors.notFound("Upload");
  const event = await eventRepository.getOrThrow(media.eventId);
  await assertCanWrite(actor, event, media.purpose, media.registrationId);
  return { media, event };
}

export const signPartsSchema = z.object({ partNumbers: z.array(z.coerce.number().int().min(1).max(10_000)).min(1).max(100) });

export async function signUploadParts(actor: SessionUser | null, mediaId: string, rawInput: unknown): Promise<{ parts: { partNumber: number; url: string }[] }> {
  assertAuthenticated(actor);
  const { partNumbers } = parseInput(signPartsSchema, rawInput);
  await connectDB();
  await enforceRateLimit(`media:${actor.id}`, RATE_LIMITS.mediaOps);
  const { media } = await loadOwnPendingUpload(actor, mediaId);
  if (media.processingStatus !== "pending" || !media.multipartUploadId) throw errors.conflict("This upload does not accept parts", "INVALID_STATE");
  const maxPart = Math.ceil(media.declaredSize / MULTIPART_PART_SIZE_BYTES);
  if (partNumbers.some((n) => n > maxPart)) throw errors.badRequest("Part number out of range");
  const storage = getStorage();
  const parts = await Promise.all(partNumbers.map(async (partNumber) => ({ partNumber, url: await storage.presignUploadPart(media.storageKey, media.multipartUploadId!, partNumber, UPLOAD_URL_TTL_SECONDS) })));
  return { parts };
}

export const completeUploadSchema = z.object({
  parts: z.array(z.object({ partNumber: z.number().int().min(1).max(10_000), etag: z.string().min(1).max(200) })).max(10_000).optional(),
});

async function failMedia(media: EventMediaDoc, reason: string) {
  await EventMediaModel.updateOne({ _id: media._id }, { $set: { processingStatus: "failed", failureReason: reason } });
  try {
    await getStorage().deleteObject(media.storageKey);
    await EventMediaModel.updateOne({ _id: media._id }, { $set: { purgedAt: new Date() } });
  } catch (err) {
    logger.warn("media.fail_cleanup_deferred", { mediaId: media._id, err }); // maintenance retries
  }
}

/**
 * Step 3: verify what actually landed in R2 (size, signature, decodability,
 * duration) before the media can ever be served. Idempotent: a repeated call
 * returns the current state without reprocessing.
 */
export async function completeUpload(actor: SessionUser | null, mediaId: string, rawInput: unknown): Promise<MediaDTO> {
  assertAuthenticated(actor);
  const input = parseInput(completeUploadSchema, rawInput);
  await connectDB();
  await enforceRateLimit(`media:${actor.id}`, RATE_LIMITS.mediaOps);
  const { media, event } = await loadOwnPendingUpload(actor, mediaId);
  if (media.processingStatus !== "pending") return toMediaDTO(media, actor.id);

  const storage = getStorage();
  if (media.multipartUploadId) {
    if (!input.parts?.length) throw errors.badRequest("Multipart uploads must list their parts");
    await storage.completeMultipartUpload(media.storageKey, media.multipartUploadId, input.parts);
  }

  const claimed = await EventMediaModel.findOneAndUpdate(
    { _id: media._id, processingStatus: "pending" },
    { $set: { processingStatus: "processing", uploadCompletedAt: new Date(), multipartUploadId: null } },
    { returnDocument: "after" },
  ).lean<EventMediaDoc>();
  if (!claimed) return toMediaDTO((await EventMediaModel.findById(media._id).lean<EventMediaDoc>())!, actor.id);

  const head = await storage.headObject(media.storageKey);
  if (!head) {
    // Not uploaded yet (or still propagating): allow the client to retry completion.
    await EventMediaModel.updateOne({ _id: media._id, processingStatus: "processing" }, { $set: { processingStatus: "pending", uploadCompletedAt: null } });
    throw errors.conflict("The file has not been uploaded yet", "UPLOAD_MISSING");
  }
  if (head.size !== media.declaredSize || head.size > maxBytesFor(media.mediaType, media.purpose)) {
    await failMedia(claimed, "Uploaded size does not match the declared size");
    throw errors.unprocessable("Uploaded file size does not match", "SIZE_MISMATCH");
  }
  // Images are needed in full for decoding anyway (bounded by the image size limit); videos only need the header.
  const imageBuffer = media.mediaType === "image" ? await storage.getBuffer(media.storageKey, maxBytesFor("image", media.purpose)) : null;
  const leading = imageBuffer ?? (await storage.getRange(media.storageKey, 0, Math.min(head.size, 64 * 1024) - 1));
  const detected = detectMimeFromSignature(leading.subarray(0, 64 * 1024));
  if (!isSignatureCompatible(media.mimeType as AllowedMimeType, detected)) {
    await failMedia(claimed, `File signature does not match ${media.mimeType}`);
    throw errors.unsupportedType("The file content does not match its type");
  }

  const set: Partial<EventMediaDoc> = { sizeBytes: head.size };
  try {
    if (imageBuffer) {
      const buffer = imageBuffer;
      const image = sharp(buffer, { limitInputPixels: 100_000_000, failOn: "error" });
      const meta = await image.metadata();
      if (!meta.width || !meta.height) throw new Error("Image has no dimensions");
      const thumb = await sharp(buffer, { limitInputPixels: 100_000_000 }).rotate().resize({ width: THUMBNAIL_WIDTH, withoutEnlargement: true }).webp({ quality: 78 }).toBuffer();
      const thumbnailKey = `${media.storageKey}.thumb.webp`;
      await storage.putObject(thumbnailKey, thumb, "image/webp");
      Object.assign(set, { width: meta.width, height: meta.height, thumbnailKey });
    } else if (media.mimeType !== "video/webm") {
      const windowSize = 2 * 1024 * 1024;
      let duration = parseIsoBmffDuration(await storage.getRange(media.storageKey, 0, Math.min(head.size, windowSize) - 1));
      if (duration === null && head.size > windowSize) duration = parseIsoBmffDuration(await storage.getRange(media.storageKey, head.size - windowSize, head.size - 1));
      const max = getEnv().MEDIA_MAX_VIDEO_DURATION_SECONDS;
      if (duration !== null && duration > max) {
        await failMedia(claimed, "Video exceeds the maximum duration");
        throw errors.unprocessable(`Videos can be at most ${Math.round(max / 60)} minutes long`, "VIDEO_TOO_LONG");
      }
      set.durationSeconds = duration;
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AppError") throw err;
    await failMedia(claimed, "The file could not be processed");
    logger.warn("media.processing_failed", { mediaId: media._id, err });
    throw errors.unprocessable("The file could not be processed", "PROCESSING_FAILED");
  }

  const moderationStatus = initialModerationStatus(media.purpose, actor.role, event.gallerySettings?.autoApprove ?? false);
  const ready = await EventMediaModel.findOneAndUpdate(
    { _id: media._id, processingStatus: "processing" },
    { $set: { ...set, processingStatus: "ready", moderationStatus, moderatedAt: moderationStatus === "approved" ? new Date() : null } },
    { returnDocument: "after" },
  ).lean<EventMediaDoc>();
  await recordAuditSafe({ actor, action: "media.upload", entityType: "media", entityId: media._id, eventId: media.eventId, metadata: { purpose: media.purpose, mediaType: media.mediaType, size: head.size } });
  return toMediaDTO(ready!, actor.id);
}

/** Cancel an in-progress upload and clean up any partial object. */
export async function abortUpload(actor: SessionUser | null, mediaId: string): Promise<void> {
  assertAuthenticated(actor);
  await connectDB();
  const media = await EventMediaModel.findOne({ _id: mediaId, uploaderId: actor.id, processingStatus: "pending", deletedAt: null }).lean<EventMediaDoc>();
  if (!media) throw errors.notFound("Upload");
  const storage = getStorage();
  if (media.multipartUploadId) await storage.abortMultipartUpload(media.storageKey, media.multipartUploadId);
  await storage.deleteObject(media.storageKey);
  await EventMediaModel.updateOne({ _id: mediaId }, { $set: { processingStatus: "failed", failureReason: "Cancelled by uploader", deletedAt: new Date(), deletedBy: actor.id, purgedAt: new Date(), multipartUploadId: null } });
}

// ---------------------------------------------------------------- read authorization & delivery

export interface AuthorizedMedia {
  media: EventMediaDoc;
  access: Exclude<MediaAccess, null>;
  key: string;
  contentType: string;
}

/**
 * Evaluated for every content request, including each HTTP range request
 * of a video, so a URL copied out of one session grants nothing on its own.
 */
export async function authorizeMediaRead(actor: SessionUser | null, mediaId: string, variant: "original" | "thumbnail"): Promise<AuthorizedMedia> {
  await connectDB();
  const media = await EventMediaModel.findById(mediaId).lean<EventMediaDoc>();
  if (!media) throw errors.notFound("Media");
  // Runs for every thumbnail and video range request: independent lookups in parallel, minimal event fields.
  const [event, verified] = await Promise.all([
    EventModel.findOne({ _id: media.eventId, deletedAt: null }).select({ status: 1, deletedAt: 1, gallerySettings: 1 }).lean<Pick<EventDoc, "status" | "deletedAt" | "gallerySettings">>(),
    actor && media.purpose === "gallery" && !isAdminRole(actor.role) ? isVerifiedAttendee(actor.id, media.eventId) : Promise.resolve(false),
  ]);
  const access = mediaReadAccess({
    actor: actor ? { id: actor.id, role: actor.role } : null,
    media,
    eventPubliclyVisible: Boolean(event && isPubliclyVisible(event)),
    galleryEnabled: event?.gallerySettings?.enabled ?? false,
    actorIsVerifiedAttendee: verified,
  });
  // 404 rather than 403 so private media existence is not revealed.
  if (!access || !event) throw errors.notFound("Media");
  if (variant === "thumbnail") {
    if (!media.thumbnailKey) throw errors.notFound("Thumbnail");
    return { media, access, key: media.thumbnailKey, contentType: "image/webp" };
  }
  return { media, access, key: media.storageKey, contentType: media.mimeType };
}

/** Short-lived (60 s) presigned download for an authorized user. */
export async function createDownloadUrl(actor: SessionUser | null, mediaId: string): Promise<{ url: string; expiresInSeconds: number }> {
  assertAuthenticated(actor);
  await enforceRateLimit(`media-dl:${actor.id}`, RATE_LIMITS.mediaDownloads);
  const { media, key, contentType } = await authorizeMediaRead(actor, mediaId, "original");
  const url = await getStorage().presignGet(key, { expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS, downloadFilename: media.originalFilename, contentType });
  await recordAuditSafe({ actor, action: "media.download", entityType: "media", entityId: mediaId, eventId: media.eventId });
  return { url, expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS };
}

// ---------------------------------------------------------------- gallery listing

export const galleryQuerySchema = paginationSchema.extend({ mediaType: optionalBlank(z.enum(["image", "video"])) });

export async function listGallery(actor: SessionUser | null, eventId: string, rawQuery: unknown): Promise<Paginated<MediaDTO>> {
  assertAuthenticated(actor);
  const query = parseInput(galleryQuerySchema, rawQuery);
  await connectDB();
  const event = await eventRepository.getOrThrow(eventId);
  const admin = isAdminRole(actor.role);
  if (!admin && !(await isVerifiedAttendee(actor.id, eventId))) throw errors.forbidden("Available to verified attendees of this event only");
  if (!admin && !event.gallerySettings?.enabled) throw errors.forbidden("The gallery is disabled for this event");

  const filter: Record<string, unknown> = {
    eventId,
    purpose: "gallery",
    deletedAt: null,
    processingStatus: "ready",
    $or: [{ moderationStatus: "approved" }, { uploaderId: actor.id }],
  };
  if (query.mediaType) filter.mediaType = query.mediaType;
  const [docs, total] = await Promise.all([
    EventMediaModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<EventMediaDoc[]>(),
    EventMediaModel.countDocuments(filter),
  ]);
  const users = await getUserSummaries(docs.map((d) => d.uploaderId));
  return buildPage(docs.map((d) => toMediaDTO(d, actor.id, users.get(d.uploaderId)?.name ?? "Attendee")), total, query);
}

// ---------------------------------------------------------------- deletion, reporting, moderation

/** Owners delete their own uploads; admins delete anything. Objects are purged by maintenance. */
export async function deleteMedia(actor: SessionUser | null, mediaId: string): Promise<void> {
  assertAuthenticated(actor);
  await connectDB();
  const media = await EventMediaModel.findOne({ _id: mediaId, deletedAt: null }).lean<EventMediaDoc>();
  if (!media) throw errors.notFound("Media");
  const admin = isAdminRole(actor.role);
  if (!admin && (media.uploaderId !== actor.id || media.purpose !== "gallery")) throw errors.notFound("Media");
  await withTransaction(async (session) => {
    await EventMediaModel.updateOne({ _id: mediaId, deletedAt: null }, { $set: { deletedAt: new Date(), deletedBy: actor.id } }, { session });
    await recordAudit({ actor, action: admin && media.uploaderId !== actor.id ? "media.admin_delete" : "media.delete", entityType: "media", entityId: mediaId, eventId: media.eventId }, session);
  });
  try {
    const storage = getStorage();
    await storage.deleteObject(media.storageKey);
    if (media.thumbnailKey) await storage.deleteObject(media.thumbnailKey);
    await EventMediaModel.updateOne({ _id: mediaId }, { $set: { purgedAt: new Date() } });
  } catch (err) {
    logger.warn("media.purge_deferred", { mediaId, err });
  }
}

export const reportMediaSchema = z.object({ reason: z.string().trim().min(3).max(500) });

/**
 * Privacy/consent removal request from any attendee who can see the item.
 * The item is hidden immediately and queued for admin review.
 */
export async function reportMedia(actor: SessionUser | null, mediaId: string, rawInput: unknown): Promise<void> {
  assertAuthenticated(actor);
  const { reason } = parseInput(reportMediaSchema, rawInput);
  await enforceRateLimit(`report:${actor.id}`, RATE_LIMITS.reports);
  const { media } = await authorizeMediaRead(actor, mediaId, "original");
  await withTransaction(async (session) => {
    await EventMediaModel.updateOne({ _id: mediaId }, { $inc: { reportCount: 1 }, $set: { moderationStatus: "pending", moderationReason: "Reported — under review" } }, { session });
    await recordAudit({ actor, action: "media.report", entityType: "media", entityId: mediaId, eventId: media.eventId, metadata: { reason } }, session);
  });
}

export const moderateSchema = z.object({ decision: z.enum(["approved", "rejected"]), reason: optionalTrimmed(500) });

export async function moderateMedia(actor: SessionUser | null, mediaId: string, rawInput: unknown): Promise<MediaDTO> {
  assertAdmin(actor);
  const { decision, reason } = parseInput(moderateSchema, rawInput);
  await connectDB();
  const updated = await withTransaction(async (session) => {
    const doc = await EventMediaModel.findOneAndUpdate(
      { _id: mediaId, deletedAt: null, processingStatus: "ready" },
      { $set: { moderationStatus: decision, moderatedBy: actor.id, moderatedAt: new Date(), moderationReason: reason ?? null, ...(decision === "approved" ? { reportCount: 0 } : {}) } },
      { returnDocument: "after", session },
    ).lean<EventMediaDoc>();
    if (!doc) throw errors.notFound("Media");
    await recordAudit({ actor, action: `media.${decision === "approved" ? "approve" : "reject"}`, entityType: "media", entityId: mediaId, eventId: doc.eventId, metadata: { reason } }, session);
    return doc;
  });
  if (updated.purpose === "gallery" && updated.uploaderId !== actor.id) {
    await notify({
      userId: updated.uploaderId,
      type: "media_moderated",
      title: decision === "approved" ? "Your upload is now visible" : "Your upload was not approved",
      body: decision === "approved" ? `"${updated.originalFilename}" was approved and is visible in the event gallery.` : `"${updated.originalFilename}" was not approved.${reason ? ` Reason: ${reason}` : ""}`,
      link: `/my-gallery/${updated.eventId}`,
      dedupeKey: `media_moderated:${mediaId}:${updated.moderatedAt?.getTime()}`,
    });
  }
  return toMediaDTO(updated, actor.id);
}

export const moderationQuerySchema = paginationSchema.extend({
  eventId: optionalBlank(z.uuid()),
  status: z.enum(["pending", "approved", "rejected"]).default("pending"),
});

export async function listModerationQueue(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<MediaDTO & { reportCount: number }>> {
  assertAdmin(actor);
  const query = parseInput(moderationQuerySchema, rawQuery);
  await connectDB();
  const filter: Record<string, unknown> = { purpose: "gallery", deletedAt: null, processingStatus: "ready", moderationStatus: query.status };
  if (query.eventId) filter.eventId = query.eventId;
  const [docs, total] = await Promise.all([
    EventMediaModel.find(filter).sort({ reportCount: -1, createdAt: 1 }).skip(toSkip(query)).limit(query.pageSize).lean<EventMediaDoc[]>(),
    EventMediaModel.countDocuments(filter),
  ]);
  const users = await getUserSummaries(docs.map((d) => d.uploaderId));
  return buildPage(docs.map((d) => ({ ...toMediaDTO(d, actor.id, users.get(d.uploaderId)?.name ?? "Unknown"), reportCount: d.reportCount })), total, query);
}

