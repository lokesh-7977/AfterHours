import "server-only";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { countBy } from "@/lib/aggregate";
import { generateHumanCode, keyedHash, normalizeHumanCode } from "@/lib/crypto";
import { errors, isDuplicateKeyError } from "@/lib/errors";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { RATE_LIMITS, consumeRateLimit, enforceRateLimit, isRateLimited } from "@/lib/rate-limit";
import { withTransaction, type TxSession } from "@/lib/transactions";
import { optionalTrimmed, parseInput, optionalBlank } from "@/lib/validation";
import { assertAdmin, assertAuthenticated, assertParticipant } from "@/modules/auth/policies";
import { isAdminRole, type SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { EventModel, type EventDoc } from "@/modules/events/event.model";
import { EVENT_SUMMARY_PROJECTION, eventRepository } from "@/modules/events/event.repository";
import { toEventSummary, type EventSummaryDTO } from "@/modules/events/event.dto";
import { PassModel, type PassDoc } from "@/modules/passes/pass.model";
import { PASS_INVALID_MESSAGES, extractQrToken, passInvalidReason, type PassInvalidReason } from "@/modules/passes/pass.policy";
import { findPassByToken } from "@/modules/passes/pass.service";
import { RegistrationModel, type RegistrationDoc } from "@/modules/registrations/registration.model";
import { notify } from "@/modules/notifications/notification.service";
import { getUserSummaries, type UserSummary } from "@/modules/users/user.service";
import { AttendanceCodeModel, AttendanceModel, type AttendanceCodeDoc, type AttendanceDoc, type AttendanceMethod, type AttendanceStatus } from "./attendance.model";
import { MAX_CODE_LIFETIME_MINUTES, attendanceCodeUnusableReason, initialAttendanceStatus } from "./attendance.policy";

const CODE_HASH_PURPOSE = "attendance-code";

// ---------------------------------------------------------------- access checks

export async function isVerifiedAttendee(userId: string, eventId: string): Promise<boolean> {
  await connectDB();
  return (await AttendanceModel.exists({ eventId, userId, status: "verified" })) !== null;
}

/**
 * Gallery/feedback gate. Evaluated server-side for every request: attendance
 * for event A never grants access to event B.
 */
export async function assertVerifiedAttendee(actor: SessionUser | null, eventId: string): Promise<void> {
  assertAuthenticated(actor);
  if (isAdminRole(actor.role)) return;
  if (!(await isVerifiedAttendee(actor.id, eventId))) {
    throw errors.forbidden("Available to verified attendees of this event only");
  }
}

// ---------------------------------------------------------------- check-in core

export interface CheckInOutcome {
  outcome: "checked_in" | "already_checked_in" | "pending_confirmation" | "confirmed" | "rejected";
  reason?: PassInvalidReason | "UNKNOWN_PASS" | "ATTENDANCE_REVOKED";
  message: string;
  attendee?: { name: string; email: string } | null;
  eventTitle?: string;
  checkedInAt?: string;
}

interface CheckInArgs {
  event: EventDoc;
  registration: RegistrationDoc;
  pass: PassDoc;
  method: AttendanceMethod;
  status: "verified" | "pending_confirmation";
  verifiedBy: string | null;
  attendanceCodeId?: string | null;
  allowRestoreRevoked: boolean;
}

/**
 * Insert or upgrade the attendance record. The unique (eventId, userId) index
 * makes concurrent duplicate check-ins impossible: the loser's duplicate-key
 * error re-runs the unit (withTransaction), which then sees the winner here.
 */
async function recordCheckIn(args: CheckInArgs, session?: TxSession): Promise<{ doc: AttendanceDoc; created: boolean; upgraded: boolean }> {
  const now = new Date();
  const existing = await AttendanceModel.findOne({ eventId: args.event._id, userId: args.registration.userId }).session(session ?? null).lean<AttendanceDoc>();
  if (!existing) {
    const [created] = await AttendanceModel.create(
      [
        {
          eventId: args.event._id,
          userId: args.registration.userId,
          registrationId: args.registration._id,
          passId: args.pass._id,
          method: args.method,
          status: args.status,
          attendanceCodeId: args.attendanceCodeId ?? null,
          verifiedBy: args.verifiedBy,
          checkedInAt: now,
          confirmedAt: args.status === "verified" ? now : null,
        },
      ],
      { session },
    );
    return { doc: created.toObject() as AttendanceDoc, created: true, upgraded: false };
  }
  const canUpgrade = args.status === "verified" && (existing.status === "pending_confirmation" || (existing.status === "revoked" && args.allowRestoreRevoked));
  if (!canUpgrade) return { doc: existing, created: false, upgraded: false };
  const upgraded = await AttendanceModel.findOneAndUpdate(
    { _id: existing._id, status: existing.status },
    { $set: { status: "verified", method: args.method, verifiedBy: args.verifiedBy, confirmedAt: now, revokedAt: null, revokedBy: null, revocationReason: null, passId: args.pass._id } },
    { returnDocument: "after", session },
  ).lean<AttendanceDoc>();
  return { doc: upgraded ?? existing, created: false, upgraded: Boolean(upgraded) };
}

async function notifyVerified(userId: string, event: EventDoc) {
  await notify({
    userId,
    type: "attendance_verified",
    title: `Attendance verified: ${event.title}`,
    body: event.gallerySettings?.enabled ? "Welcome! The private event gallery is now unlocked for you." : "Welcome! Your attendance has been recorded.",
    link: event.gallerySettings?.enabled ? `/my-gallery/${event._id}` : "/my-passes",
    dedupeKey: `attendance_verified:${event._id}:${userId}`,
  });
}

// ---------------------------------------------------------------- QR scanning (staff)

export const scanSchema = z.object({ eventId: z.uuid(), payload: z.string().trim().min(10).max(200) });

/**
 * Staff scanner endpoint. The QR carries only an opaque token; everything
 * else (owner, payment state, event) is looked up server-side.
 */
export async function scanPass(actor: SessionUser | null, rawInput: unknown): Promise<CheckInOutcome> {
  assertAdmin(actor);
  const input = parseInput(scanSchema, rawInput);
  await connectDB();
  await enforceRateLimit(`scan:${actor.id}`, RATE_LIMITS.qrScans);

  const event = await eventRepository.getOrThrow(input.eventId);
  const token = extractQrToken(input.payload);
  const pass = token ? await findPassByToken(token) : null;
  if (!pass) {
    await recordAudit({ actor, action: "attendance.scan_rejected", entityType: "event", entityId: event._id, eventId: event._id, metadata: { reason: "UNKNOWN_PASS" } });
    return { outcome: "rejected", reason: "UNKNOWN_PASS", message: "Unknown or invalid QR code" };
  }
  const [registration, passEvent, users] = await Promise.all([
    RegistrationModel.findById(pass.registrationId).lean<RegistrationDoc>(),
    pass.eventId === event._id ? event : eventRepository.findById(pass.eventId, { includeDeleted: true }),
    getUserSummaries([pass.userId]),
  ]);
  const reason = passInvalidReason({ pass, registration, event: passEvent, expectedEventId: event._id, enforceCheckInWindow: true });
  const attendee = users.get(pass.userId);
  const who = attendee ? { name: attendee.name, email: attendee.email } : null;
  if (reason || !registration) {
    await recordAudit({ actor, action: "attendance.scan_rejected", entityType: "pass", entityId: pass._id, eventId: event._id, metadata: { reason } });
    const r = reason ?? "REGISTRATION_INACTIVE";
    return { outcome: "rejected", reason: r, message: PASS_INVALID_MESSAGES[r], attendee: who, eventTitle: event.title };
  }

  const result = await withTransaction(async (session) => {
    const res = await recordCheckIn({ event, registration, pass, method: "qr_scan", status: "verified", verifiedBy: actor.id, allowRestoreRevoked: false }, session);
    if (res.created || res.upgraded) {
      await recordAudit({ actor, action: res.created ? "attendance.check_in" : "attendance.confirm", entityType: "attendance", entityId: res.doc._id, eventId: event._id, metadata: { method: "qr_scan", passId: pass._id } }, session);
    }
    return res;
  });

  if (result.doc.status === "revoked") {
    return { outcome: "rejected", reason: "ATTENDANCE_REVOKED", message: "Attendance for this pass was revoked by an admin", attendee: who, eventTitle: event.title };
  }
  if (result.created || result.upgraded) await notifyVerified(pass.userId, event);
  return {
    outcome: result.created ? "checked_in" : result.upgraded ? "confirmed" : "already_checked_in",
    message: result.created ? "Checked in" : result.upgraded ? "Pending check-in confirmed" : "Already checked in",
    attendee: who,
    eventTitle: event.title,
    checkedInAt: result.doc.checkedInAt.toISOString(),
  };
}

// ---------------------------------------------------------------- shared attendance codes

export const createCodeSchema = z.object({
  expiresInMinutes: z.coerce.number().int().min(5).max(MAX_CODE_LIFETIME_MINUTES).default(180),
  maxUses: z.preprocess((v) => (v === "" || v === null ? undefined : v), z.coerce.number().int().min(1).max(100_000).optional()),
  label: optionalTrimmed(80),
});

export interface AttendanceCodeDTO {
  id: string;
  label: string | null;
  expiresAt: string;
  revokedAt: string | null;
  maxUses: number | null;
  useCount: number;
  active: boolean;
  usable: boolean;
  createdAt: string;
}

function toCodeDTO(c: AttendanceCodeDoc): AttendanceCodeDTO {
  return {
    id: c._id,
    label: c.label,
    expiresAt: c.expiresAt.toISOString(),
    revokedAt: c.revokedAt?.toISOString() ?? null,
    maxUses: c.maxUses,
    useCount: c.useCount,
    active: c.active,
    usable: attendanceCodeUnusableReason(c) === null,
    createdAt: c.createdAt.toISOString(),
  };
}

/** Returns the plaintext code exactly once; only its keyed hash is stored. */
export async function createAttendanceCode(actor: SessionUser | null, eventId: string, rawInput: unknown): Promise<{ code: string; record: AttendanceCodeDTO }> {
  assertAdmin(actor);
  const input = parseInput(createCodeSchema, rawInput);
  await connectDB();
  const event = await eventRepository.getOrThrow(eventId);
  if (event.status !== "published") throw errors.conflict("Attendance codes can only be created for published events", "INVALID_STATE");

  for (let attempt = 0; attempt < 3; attempt++) {
    const code = generateHumanCode();
    try {
      const record = await withTransaction(async (session) => {
        const [doc] = await AttendanceCodeModel.create(
          [{ eventId, codeHash: keyedHash(CODE_HASH_PURPOSE, normalizeHumanCode(code)), label: input.label ?? null, createdBy: actor.id, expiresAt: new Date(Date.now() + input.expiresInMinutes * 60_000), maxUses: input.maxUses ?? null }],
          { session },
        );
        await recordAudit({ actor, action: "attendance_code.create", entityType: "attendance_code", entityId: doc._id, eventId, metadata: { expiresInMinutes: input.expiresInMinutes, maxUses: input.maxUses ?? null } }, session);
        return doc.toObject() as AttendanceCodeDoc;
      });
      return { code, record: toCodeDTO(record) };
    } catch (err) {
      if (!isDuplicateKeyError(err)) throw err; // astronomically unlikely collision: retry
    }
  }
  throw errors.conflict("Could not generate a unique code; retry", "CODE_COLLISION");
}

export async function revokeAttendanceCode(actor: SessionUser | null, codeId: string): Promise<AttendanceCodeDTO> {
  assertAdmin(actor);
  await connectDB();
  const doc = await withTransaction(async (session) => {
    const updated = await AttendanceCodeModel.findOneAndUpdate(
      { _id: codeId, revokedAt: null },
      { $set: { revokedAt: new Date(), revokedBy: actor.id, active: false } },
      { returnDocument: "after", session },
    ).lean<AttendanceCodeDoc>();
    if (!updated) {
      const existing = await AttendanceCodeModel.findById(codeId).session(session ?? null).lean<AttendanceCodeDoc>();
      if (!existing) throw errors.notFound("Attendance code");
      return existing;
    }
    await recordAudit({ actor, action: "attendance_code.revoke", entityType: "attendance_code", entityId: codeId, eventId: updated.eventId }, session);
    return updated;
  });
  return toCodeDTO(doc);
}

export async function listAttendanceCodes(actor: SessionUser | null, eventId: string): Promise<AttendanceCodeDTO[]> {
  assertAdmin(actor);
  await connectDB();
  const docs = await AttendanceCodeModel.find({ eventId }).sort({ createdAt: -1 }).limit(100).lean<AttendanceCodeDoc[]>();
  return docs.map(toCodeDTO);
}

export const verifyCodeSchema = z.object({ eventId: z.uuid(), code: z.string().trim().min(4).max(20) });

/**
 * Participant self check-in with a shared code. Only failed attempts count
 * toward the per-user/per-event lockout; every attempt counts toward a
 * coarser hourly cap.
 */
export async function verifyAttendanceCode(actor: SessionUser | null, rawInput: unknown): Promise<CheckInOutcome> {
  assertParticipant(actor);
  const input = parseInput(verifyCodeSchema, rawInput);
  await connectDB();
  const failKey = `attcode-fail:${actor.id}:${input.eventId}`;
  if (await isRateLimited(failKey, RATE_LIMITS.attendanceCodeFailures)) throw errors.rateLimited("Too many incorrect codes. Try again in 15 minutes.");
  await enforceRateLimit(`attcode:${actor.id}`, RATE_LIMITS.attendanceCodeAttempts);

  const event = await eventRepository.getOrThrow(input.eventId);
  if (!event.attendanceSettings?.allowCodeCheckIn) throw errors.conflict("This event does not accept attendance codes; ask staff to scan your pass", "CODE_CHECKIN_DISABLED");

  const [registration, existing] = await Promise.all([
    RegistrationModel.findOne({ eventId: event._id, userId: actor.id }).lean<RegistrationDoc>(),
    AttendanceModel.findOne({ eventId: event._id, userId: actor.id }).lean<AttendanceDoc>(),
  ]);
  const pass = registration ? await PassModel.findOne({ registrationId: registration._id }).lean<PassDoc>() : null;
  if (!registration || !pass) throw errors.conflict("You need an approved registration and an active pass to check in", "NO_PASS");
  const passReason = passInvalidReason({ pass, registration, event, expectedEventId: event._id, enforceCheckInWindow: true });
  if (passReason) throw errors.conflict(PASS_INVALID_MESSAGES[passReason], passReason);

  if (existing?.status === "verified") return { outcome: "already_checked_in", message: "You are already checked in", eventTitle: event.title, checkedInAt: existing.checkedInAt.toISOString() };
  if (existing?.status === "pending_confirmation") return { outcome: "pending_confirmation", message: "Your check-in is waiting for staff confirmation", eventTitle: event.title };
  if (existing?.status === "revoked") throw errors.forbidden("Your attendance was revoked by the organizers");

  const codeHash = keyedHash(CODE_HASH_PURPOSE, normalizeHumanCode(input.code));
  const code = await AttendanceCodeModel.findOne({ eventId: event._id, codeHash }).lean<AttendanceCodeDoc>();
  const unusable = code ? attendanceCodeUnusableReason(code) : "CODE_INACTIVE";
  if (!code || unusable) {
    await consumeRateLimit(failKey, RATE_LIMITS.attendanceCodeFailures);
    await recordAudit({ actor, action: "attendance.code_failed", entityType: "event", entityId: event._id, eventId: event._id, metadata: { reason: code ? unusable : "NO_MATCH" } });
    throw errors.unprocessable(code ? "This code is no longer valid" : "Incorrect attendance code", unusable ?? "INVALID_CODE");
  }

  const status = initialAttendanceStatus("code", event.attendanceSettings?.requireStaffConfirmation ?? false);
  const result = await withTransaction(async (session, abort) => {
    // Usage limit enforced atomically alongside the expiry/revocation checks.
    const claimed = await AttendanceCodeModel.findOneAndUpdate(
      {
        _id: code._id,
        active: true,
        revokedAt: null,
        expiresAt: { $gt: new Date() },
        $or: [{ maxUses: null }, { $expr: { $lt: ["$useCount", "$maxUses"] } }],
      },
      { $inc: { useCount: 1 } },
      { returnDocument: "after", session },
    ).lean<AttendanceCodeDoc>();
    if (!claimed) throw errors.unprocessable("This code is no longer valid", "CODE_EXHAUSTED");
    const res = await recordCheckIn({ event, registration, pass, method: "code", status, verifiedBy: null, attendanceCodeId: code._id, allowRestoreRevoked: false }, session);
    // A concurrent check-in won: roll back the code use and report the existing record.
    if (!res.created) return abort(res);
    await recordAudit({ actor, action: "attendance.check_in", entityType: "attendance", entityId: res.doc._id, eventId: event._id, metadata: { method: "code", codeId: code._id, status } }, session);
    return res;
  });

  if (!result.created) {
    return { outcome: result.doc.status === "verified" ? "already_checked_in" : "pending_confirmation", message: "Already checked in", eventTitle: event.title };
  }
  if (status === "verified") await notifyVerified(actor.id, event);
  return {
    outcome: status === "verified" ? "checked_in" : "pending_confirmation",
    message: status === "verified" ? "Attendance verified — the gallery is unlocked" : "Code accepted. Staff will confirm your attendance at the venue.",
    eventTitle: event.title,
    checkedInAt: result.doc.checkedInAt.toISOString(),
  };
}

// ---------------------------------------------------------------- admin corrections

export async function confirmAttendance(actor: SessionUser | null, attendanceId: string): Promise<AttendanceDoc> {
  assertAdmin(actor);
  await connectDB();
  const doc = await withTransaction(async (session) => {
    const updated = await AttendanceModel.findOneAndUpdate(
      { _id: attendanceId, status: "pending_confirmation" },
      { $set: { status: "verified", verifiedBy: actor.id, confirmedAt: new Date() } },
      { returnDocument: "after", session },
    ).lean<AttendanceDoc>();
    if (!updated) throw errors.conflict("Only pending check-ins can be confirmed", "INVALID_STATE");
    await recordAudit({ actor, action: "attendance.confirm", entityType: "attendance", entityId: attendanceId, eventId: updated.eventId }, session);
    return updated;
  });
  const event = await eventRepository.findById(doc.eventId);
  if (event) await notifyVerified(doc.userId, event);
  return doc;
}

export const revokeAttendanceSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function revokeAttendance(actor: SessionUser | null, attendanceId: string, rawInput: unknown): Promise<AttendanceDoc> {
  assertAdmin(actor);
  const { reason } = parseInput(revokeAttendanceSchema, rawInput);
  await connectDB();
  return withTransaction(async (session) => {
    const updated = await AttendanceModel.findOneAndUpdate(
      { _id: attendanceId, status: { $ne: "revoked" } },
      { $set: { status: "revoked", revokedAt: new Date(), revokedBy: actor.id, revocationReason: reason } },
      { returnDocument: "after", session },
    ).lean<AttendanceDoc>();
    if (!updated) throw errors.conflict("Attendance is already revoked or does not exist", "INVALID_STATE");
    await recordAudit({ actor, action: "attendance.revoke", entityType: "attendance", entityId: attendanceId, eventId: updated.eventId, metadata: { reason } }, session);
    return updated;
  });
}

/** Staff check-in without scanning (e.g. phone died). Requires the same pass eligibility. */
export async function manualCheckIn(actor: SessionUser | null, registrationId: string): Promise<CheckInOutcome> {
  assertAdmin(actor);
  await connectDB();
  const registration = await RegistrationModel.findById(registrationId).lean<RegistrationDoc>();
  if (!registration) throw errors.notFound("Registration");
  const [pass, event] = await Promise.all([
    PassModel.findOne({ registrationId }).lean<PassDoc>(),
    eventRepository.findById(registration.eventId),
  ]);
  if (!event) throw errors.notFound("Event");
  if (!pass) throw errors.conflict("No pass has been issued for this registration", "NO_PASS");
  const reason = passInvalidReason({ pass, registration, event, enforceCheckInWindow: false });
  if (reason) throw errors.conflict(PASS_INVALID_MESSAGES[reason], reason);
  const res = await withTransaction(async (session) => {
    const r = await recordCheckIn({ event, registration, pass, method: "manual", status: "verified", verifiedBy: actor.id, allowRestoreRevoked: true }, session);
    if (r.created || r.upgraded) {
      await recordAudit({ actor, action: "attendance.manual_check_in", entityType: "attendance", entityId: r.doc._id, eventId: event._id, metadata: { registrationId, restored: r.upgraded } }, session);
    }
    return r;
  });
  if (res.created || res.upgraded) await notifyVerified(registration.userId, event);
  return { outcome: res.created ? "checked_in" : res.upgraded ? "confirmed" : "already_checked_in", message: res.created || res.upgraded ? "Checked in" : "Already checked in", eventTitle: event.title };
}

// ---------------------------------------------------------------- reporting

export const checkInQuerySchema = paginationSchema.extend({
  status: optionalBlank(z.enum(["verified", "pending_confirmation", "revoked"])),
});

export interface AttendanceDTO {
  id: string;
  eventId: string;
  registrationId: string;
  user: UserSummary | null;
  method: AttendanceMethod;
  status: AttendanceStatus;
  checkedInAt: string;
  confirmedAt: string | null;
  revocationReason: string | null;
}

export async function listCheckIns(actor: SessionUser | null, eventId: string | null, rawQuery: unknown): Promise<Paginated<AttendanceDTO>> {
  assertAdmin(actor);
  const query = parseInput(checkInQuerySchema, rawQuery);
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (eventId) filter.eventId = eventId;
  if (query.status) filter.status = query.status;
  const [docs, total] = await Promise.all([
    AttendanceModel.find(filter).sort({ checkedInAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<AttendanceDoc[]>(),
    AttendanceModel.countDocuments(filter),
  ]);
  const users = await getUserSummaries(docs.map((d) => d.userId));
  return buildPage(
    docs.map((d) => ({
      id: d._id,
      eventId: d.eventId,
      registrationId: d.registrationId,
      user: users.get(d.userId) ?? null,
      method: d.method,
      status: d.status,
      checkedInAt: d.checkedInAt.toISOString(),
      confirmedAt: d.confirmedAt?.toISOString() ?? null,
      revocationReason: d.revocationReason ?? null,
    })),
    total,
    query,
  );
}

export async function attendanceStats(actor: SessionUser | null, eventId: string): Promise<{ verified: number; pending: number; revoked: number; approvedRegistrations: number; rate: number }> {
  assertAdmin(actor);
  await connectDB();
  const [rows, approvedRegistrations] = await Promise.all([
    countBy<AttendanceStatus>(AttendanceModel, "status", { eventId }),
    RegistrationModel.countDocuments({ eventId, status: "registered", paymentStatus: "approved" }),
  ]);
  const by = rows;
  const verified = by.verified ?? 0;
  return { verified, pending: by.pending_confirmation ?? 0, revoked: by.revoked ?? 0, approvedRegistrations, rate: approvedRegistrations ? verified / approvedRegistrations : 0 };
}

/** Events whose private gallery the participant has unlocked. */
export async function listMyAttendedEvents(actor: SessionUser | null): Promise<EventSummaryDTO[]> {
  assertAuthenticated(actor);
  await connectDB();
  const rows = await AttendanceModel.find({ userId: actor.id, status: "verified" }).sort({ checkedInAt: -1 }).limit(200).lean<AttendanceDoc[]>();
  const events = await EventModel.find({ _id: { $in: rows.map((r) => r.eventId) }, deletedAt: null }, EVENT_SUMMARY_PROJECTION).lean<EventDoc[]>();
  const byId = new Map(events.map((e) => [e._id, e]));
  return rows.map((r) => byId.get(r.eventId)).filter((e): e is EventDoc => Boolean(e)).map(toEventSummary);
}

