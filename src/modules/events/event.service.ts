import "server-only";
import { connectDB } from "@/lib/db";
import { randomHex } from "@/lib/crypto";
import { errors, isDuplicateKeyError } from "@/lib/errors";
import { escapeRegex, parseInput } from "@/lib/validation";
import { buildPage, toSkip, type Paginated } from "@/lib/pagination";
import { withTransaction, type TxSession } from "@/lib/transactions";
import { assertAdmin } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { EventMediaModel } from "@/modules/media/media.model";
import { RegistrationModel } from "@/modules/registrations/registration.model";
import { notifyMany } from "@/modules/notifications/notification.service";
import { EventModel, type EventDoc } from "./event.model";
import { EVENT_SUMMARY_PROJECTION, eventRepository } from "./event.repository";
import {
  adminEventQuerySchema,
  cancelEventSchema,
  eventInputSchema,
  publicEventQuerySchema,
  type AdminEventQuery,
  type EventInput,
  type PublicEventQuery,
} from "./event.schemas";
import { canSoftDelete, canTransition, isEditable, isPubliclyVisible, slugify, validateSchedule } from "./event.policy";
import { toEventAdmin, toEventDetail, toEventSummary, type EventAdminDTO, type EventDetailDTO, type EventSummaryDTO } from "./event.dto";

function assertValidSchedule(input: EventInput, requireFuture: boolean) {
  const fieldErrors = validateSchedule(input, { requireFuture });
  if (Object.keys(fieldErrors).length) throw errors.unprocessable("The event schedule is inconsistent", "INVALID_SCHEDULE", fieldErrors);
}

/** A poster must be an image uploaded for this very event and finished processing. */
async function assertPosterOwnership(eventId: string, mediaId: string, session?: TxSession) {
  const media = await EventMediaModel.findOne({ _id: mediaId, eventId, purpose: "poster", deletedAt: null }).session(session ?? null).lean();
  if (!media) throw errors.unprocessable("The poster does not belong to this event", "INVALID_POSTER", { posterMediaId: ["Unknown poster"] });
  if (media.processingStatus !== "ready") throw errors.unprocessable("The poster upload has not finished processing", "POSTER_NOT_READY");
}

async function uniqueSlug(base: string, exceptId?: string): Promise<string> {
  const root = slugify(base) || "event";
  if (!(await eventRepository.slugExists(root, exceptId))) return root;
  for (let i = 0; i < 5; i++) {
    const candidate = `${root.slice(0, 72)}-${randomHex(3)}`;
    if (!(await eventRepository.slugExists(candidate, exceptId))) return candidate;
  }
  throw errors.conflict("Could not generate a unique slug; please provide one", "SLUG_TAKEN");
}

function toPersisted(input: EventInput) {
  return {
    title: input.title,
    summary: input.summary,
    description: input.description,
    category: input.category,
    tags: input.tags,
    venueName: input.venueName,
    venueAddress: input.venueAddress,
    city: input.city,
    location: input.latitude !== undefined && input.longitude !== undefined ? { lat: input.latitude, lng: input.longitude } : null,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    registrationOpensAt: input.registrationOpensAt,
    registrationClosesAt: input.registrationClosesAt,
    priceMinor: input.priceMinor,
    currency: input.currency,
    capacity: input.capacity,
    paymentInstructions: input.paymentInstructions ?? null,
    attendanceSettings: { requireStaffConfirmation: input.requireStaffConfirmation, allowCodeCheckIn: input.allowCodeCheckIn },
    gallerySettings: {
      enabled: input.galleryEnabled,
      uploadsEnabled: input.galleryUploadsEnabled,
      autoApprove: input.galleryAutoApprove,
      maxUploadsPerUser: input.galleryMaxUploadsPerUser,
    },
  };
}

export async function createEvent(actor: SessionUser | null, rawInput: unknown): Promise<EventAdminDTO> {
  assertAdmin(actor);
  const input = parseInput(eventInputSchema, rawInput);
  assertValidSchedule(input, true);
  await connectDB();
  if (input.slug && (await eventRepository.slugExists(input.slug))) {
    throw errors.conflict("That slug is already in use", "SLUG_TAKEN");
  }
  const slug = input.slug ?? (await uniqueSlug(input.title));
  try {
    const event = await withTransaction(async (session) => {
      const created = await eventRepository.insert({ ...toPersisted(input), slug, createdBy: actor.id, status: "draft" }, session);
      await recordAudit({ actor, action: "event.create", entityType: "event", entityId: created._id, eventId: created._id, metadata: { title: created.title } }, session);
      return created;
    });
    return toEventAdmin(event);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw errors.conflict("That slug is already in use", "SLUG_TAKEN");
    throw err;
  }
}

export async function updateEvent(actor: SessionUser | null, eventId: string, rawInput: unknown): Promise<EventAdminDTO> {
  assertAdmin(actor);
  const input = parseInput(eventInputSchema, rawInput);
  const existing = await getManageableEvent(actor, eventId);
  if (!isEditable(existing.status)) throw errors.conflict(`A ${existing.status} event cannot be edited`, "INVALID_STATE");
  assertValidSchedule(input, existing.status === "published");
  if (input.capacity < existing.registeredCount) {
    throw errors.unprocessable(`Capacity cannot be lower than the ${existing.registeredCount} seats already taken`, "CAPACITY_BELOW_REGISTRATIONS", {
      capacity: [`Minimum ${existing.registeredCount}`],
    });
  }
  const slug = input.slug ?? existing.slug;
  if (slug !== existing.slug && (await eventRepository.slugExists(slug, eventId))) throw errors.conflict("That slug is already in use", "SLUG_TAKEN");

  try {
    const updated = await withTransaction(async (session) => {
      if (input.posterMediaId) await assertPosterOwnership(eventId, input.posterMediaId, session);
      const set: Partial<EventDoc> = { ...toPersisted(input), slug };
      if (input.posterMediaId !== undefined) set.posterMediaId = input.posterMediaId;
      // The capacity guard is repeated in the filter so a concurrent registration cannot slip under it.
      const doc = await eventRepository.updateWhere(eventId, { status: existing.status, registeredCount: { $lte: input.capacity } }, set, session);
      if (!doc) throw errors.conflict("The event changed while saving; reload and try again", "CONCURRENT_UPDATE");
      await recordAudit({ actor, action: "event.update", entityType: "event", entityId: eventId, eventId }, session);
      return doc;
    });
    return toEventAdmin(updated);
  } catch (err) {
    if (isDuplicateKeyError(err)) throw errors.conflict("That slug is already in use", "SLUG_TAKEN");
    throw err;
  }
}

export async function setEventPoster(actor: SessionUser | null, eventId: string, mediaId: string | null): Promise<EventAdminDTO> {
  assertAdmin(actor);
  const existing = await getManageableEvent(actor, eventId);
  if (!isEditable(existing.status)) throw errors.conflict(`A ${existing.status} event cannot be edited`, "INVALID_STATE");
  const updated = await withTransaction(async (session) => {
    if (mediaId) await assertPosterOwnership(eventId, mediaId, session);
    const doc = await eventRepository.updateWhere(eventId, {}, { posterMediaId: mediaId }, session);
    if (!doc) throw errors.notFound("Event");
    await recordAudit({ actor, action: "event.poster_set", entityType: "event", entityId: eventId, eventId, metadata: { mediaId } }, session);
    return doc;
  });
  return toEventAdmin(updated);
}

async function transition(
  actor: SessionUser,
  eventId: string,
  to: "published" | "cancelled" | "completed",
  extra: Partial<EventDoc>,
  auditMeta: Record<string, unknown> = {},
  preloaded?: EventDoc,
): Promise<EventDoc> {
  const existing = preloaded ?? (await getManageableEvent(actor, eventId));
  if (existing.status === to) return existing; // idempotent
  if (!canTransition(existing.status, to)) throw errors.conflict(`Cannot change a ${existing.status} event to ${to}`, "INVALID_TRANSITION");
  return withTransaction(async (session) => {
    const doc = await eventRepository.updateWhere(eventId, { status: existing.status }, { status: to, ...extra }, session);
    if (!doc) throw errors.conflict("The event changed concurrently; reload and try again", "CONCURRENT_UPDATE");
    await recordAudit({ actor, action: `event.${to === "published" ? "publish" : to === "cancelled" ? "cancel" : "complete"}`, entityType: "event", entityId: eventId, eventId, metadata: auditMeta }, session);
    return doc;
  });
}

export async function publishEvent(actor: SessionUser | null, eventId: string): Promise<EventAdminDTO> {
  assertAdmin(actor);
  const existing = await getManageableEvent(actor, eventId);
  const fieldErrors = validateSchedule(existing, { requireFuture: true });
  if (Object.keys(fieldErrors).length) throw errors.unprocessable("Fix the schedule before publishing", "INVALID_SCHEDULE", fieldErrors);
  if (existing.posterMediaId) await assertPosterOwnership(eventId, existing.posterMediaId);
  const doc = await transition(actor, eventId, "published", { publishedAt: existing.publishedAt ?? new Date() }, {}, existing);
  return toEventAdmin(doc);
}

export async function cancelEvent(actor: SessionUser | null, eventId: string, rawInput: unknown): Promise<EventAdminDTO> {
  assertAdmin(actor);
  const { reason } = parseInput(cancelEventSchema, rawInput);
  const doc = await transition(actor, eventId, "cancelled", { cancelledAt: new Date(), cancelledBy: actor.id, cancellationReason: reason }, { reason });
  await notifyEventCancelled(doc);
  return toEventAdmin(doc);
}

export async function completeEvent(actor: SessionUser | null, eventId: string): Promise<EventAdminDTO> {
  assertAdmin(actor);
  const doc = await transition(actor, eventId, "completed", { completedAt: new Date() });
  return toEventAdmin(doc);
}

export async function deleteEvent(actor: SessionUser | null, eventId: string): Promise<void> {
  assertAdmin(actor);
  const existing = await getManageableEvent(actor, eventId);
  if (!canSoftDelete(existing)) {
    throw errors.conflict("Cancel the event before deleting it: participants hold registrations", "HAS_REGISTRATIONS");
  }
  await withTransaction(async (session) => {
    const doc = await eventRepository.updateWhere(eventId, { status: existing.status, registeredCount: existing.registeredCount }, { deletedAt: new Date(), deletedBy: actor.id }, session);
    if (!doc) throw errors.conflict("The event changed concurrently; reload and try again", "CONCURRENT_UPDATE");
    await recordAudit({ actor, action: "event.delete", entityType: "event", entityId: eventId, eventId, metadata: { slug: existing.slug } }, session);
  });
}

/** Fan out cancellation notices; deterministic keys make re-runs safe. */
async function notifyEventCancelled(event: EventDoc): Promise<void> {
  const cursor = RegistrationModel.find({ eventId: event._id, status: "registered" }).select({ userId: 1 }).lean().cursor();
  let batch: Parameters<typeof notifyMany>[0] = [];
  for await (const reg of cursor) {
    batch.push({
      userId: reg.userId,
      type: "event_cancelled",
      title: `Cancelled: ${event.title}`,
      body: `${event.title} has been cancelled.${event.cancellationReason ? ` Reason: ${event.cancellationReason}` : ""} The organizers will contact you about any refund.`,
      link: `/event/${event.slug}`,
      dedupeKey: `event_cancelled:${event._id}:${reg.userId}`,
    });
    if (batch.length >= 500) {
      await notifyMany(batch);
      batch = [];
    }
  }
  await notifyMany(batch);
}

/** Admin read access to an event (deleted events are hidden). */
export async function getManageableEvent(actor: SessionUser | null, eventId: string): Promise<EventDoc> {
  assertAdmin(actor);
  await connectDB();
  const event = await eventRepository.getOrThrow(eventId);
  return event;
}

export async function getAdminEvent(actor: SessionUser | null, eventId: string): Promise<EventAdminDTO> {
  return toEventAdmin(await getManageableEvent(actor, eventId));
}

export async function listAdminEvents(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<EventAdminDTO>> {
  assertAdmin(actor);
  const query: AdminEventQuery = parseInput(adminEventQuerySchema, rawQuery);
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (!query.includeDeleted) filter.deletedAt = null;
  if (query.status) filter.status = query.status;
  if (query.q) filter.title = { $regex: escapeRegex(query.q), $options: "i" };
  const [docs, total] = await Promise.all([
    EventModel.find(filter).sort({ startsAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<EventDoc[]>(),
    EventModel.countDocuments(filter),
  ]);
  return buildPage(docs.map(toEventAdmin), total, query);
}

export async function listPublicEvents(rawQuery: unknown): Promise<Paginated<EventSummaryDTO>> {
  const query: PublicEventQuery = parseInput(publicEventQuerySchema, rawQuery);
  await connectDB();
  const now = new Date();
  const filter: Record<string, unknown> = { deletedAt: null };
  if (query.when === "upcoming") {
    filter.status = { $in: ["published", "cancelled"] };
    filter.endsAt = { $gte: now };
  } else if (query.when === "past") {
    filter.status = { $in: ["published", "completed", "cancelled"] };
    filter.endsAt = { $lt: now };
  } else {
    filter.status = { $in: ["published", "completed", "cancelled"] };
  }
  if (query.category) filter.category = query.category;
  if (query.city) filter.city = { $regex: `^${escapeRegex(query.city)}$`, $options: "i" };
  if (query.price) filter.priceMinor = query.price === "free" ? 0 : { $gt: 0 };
  if (query.from || query.to) {
    filter.startsAt = { ...(query.from ? { $gte: query.from } : {}), ...(query.to ? { $lte: query.to } : {}) };
  }
  if (query.q) filter.$text = { $search: query.q };

  const sort: Record<string, 1 | -1> =
    query.sort === "popular" ? { interestCount: -1, startsAt: 1 } : query.sort === "-startsAt" ? { startsAt: -1 } : { startsAt: query.when === "past" ? -1 : 1 };
  const [docs, total] = await Promise.all([
    EventModel.find(filter, EVENT_SUMMARY_PROJECTION).sort(sort).skip(toSkip(query)).limit(query.pageSize).lean<EventDoc[]>(),
    EventModel.countDocuments(filter),
  ]);
  return buildPage(docs.map(toEventSummary), total, query);
}

export async function getPublicEventBySlug(slug: string): Promise<EventDetailDTO | null> {
  if (!/^[a-z0-9-]{1,100}$/.test(slug)) return null;
  await connectDB();
  const event = await eventRepository.findBySlug(slug);
  if (!event || !isPubliclyVisible(event)) return null;
  return toEventDetail(event);
}

export async function getPublicEventById(eventId: string): Promise<EventDoc | null> {
  await connectDB();
  const event = await eventRepository.findById(eventId);
  return event && isPubliclyVisible(event) ? event : null;
}

export async function listEventCities(): Promise<string[]> {
  await connectDB();
  const cities = (await EventModel.distinct("city", { deletedAt: null, status: "published" })) as string[];
  return cities.sort((a, b) => a.localeCompare(b)).slice(0, 200);
}

/** Maintenance: mark ended events completed. */
export async function completeEndedEvents(now = new Date()): Promise<number> {
  await connectDB();
  const res = await EventModel.updateMany({ status: "published", deletedAt: null, endsAt: { $lt: now } }, { $set: { status: "completed", completedAt: now } });
  return res.modifiedCount;
}
