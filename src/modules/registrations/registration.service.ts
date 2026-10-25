import "server-only";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { errors, isDuplicateKeyError } from "@/lib/errors";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { withTransaction, type TxSession } from "@/lib/transactions";
import { optionalTrimmed, parseInput, optionalBlank } from "@/lib/validation";
import { assertAdmin, assertAuthenticated, assertParticipant } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { EventModel, type EventDoc } from "@/modules/events/event.model";
import { EVENT_SUMMARY_PROJECTION, eventRepository } from "@/modules/events/event.repository";
import { REGISTRATION_BLOCK_MESSAGES, registrationBlockReason } from "@/modules/events/event.policy";
import { mediaContentUrl, toEventSummary, type EventSummaryDTO } from "@/modules/events/event.dto";
import { PassModel, type PassDoc, type PassStatus } from "@/modules/passes/pass.model";
import { issuePassForRegistration } from "@/modules/passes/pass.service";
import { AttendanceModel, type AttendanceStatus } from "@/modules/attendance/attendance.model";
import { notify } from "@/modules/notifications/notification.service";
import { getUserSummaries, type UserSummary } from "@/modules/users/user.service";
import { PAYMENT_STATUSES, REGISTRATION_STATUSES, type PaymentMethod, type PaymentStatus, type RegistrationStatus } from "./registration.constants";
import { RegistrationModel, type RegistrationDoc } from "./registration.model";
import { canCancelRegistration } from "./registration.policy";

export interface RegistrationDTO {
  id: string;
  eventId: string;
  status: RegistrationStatus;
  paymentStatus: PaymentStatus;
  amountMinor: number;
  currency: string;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
  paymentNote: string | null;
  hasPaymentProof: boolean;
  paymentSubmittedAt: string | null;
  paymentVerifiedAt: string | null;
  rejectionReason: string | null;
  refundedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  passId: string | null;
  passStatus: PassStatus | null;
  attendanceStatus: AttendanceStatus | null;
}

export interface MyRegistrationDTO extends RegistrationDTO {
  event: EventSummaryDTO | null;
  paymentInstructions: string | null;
}

export interface AdminRegistrationDTO extends RegistrationDTO {
  user: UserSummary | null;
  eventTitle: string | null;
  paymentProofUrl: string | null;
  paymentVerifiedBy: string | null;
  cancellationReason: string | null;
}

export function toRegistrationDTO(r: RegistrationDoc, pass?: Pick<PassDoc, "_id" | "status"> | null, attendance?: AttendanceStatus | null): RegistrationDTO {
  return {
    id: r._id,
    eventId: r.eventId,
    status: r.status,
    paymentStatus: r.paymentStatus,
    amountMinor: r.amountMinor,
    currency: r.currency,
    paymentMethod: r.paymentMethod ?? null,
    paymentReference: r.paymentReference ?? null,
    paymentNote: r.paymentNote ?? null,
    hasPaymentProof: Boolean(r.paymentProofMediaId),
    paymentSubmittedAt: r.paymentSubmittedAt?.toISOString() ?? null,
    paymentVerifiedAt: r.paymentVerifiedAt?.toISOString() ?? null,
    rejectionReason: r.rejectionReason ?? null,
    refundedAt: r.refund?.refundedAt ? new Date(r.refund.refundedAt).toISOString() : null,
    cancelledAt: r.cancelledAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    passId: pass?._id ?? null,
    passStatus: pass?.status ?? null,
    attendanceStatus: attendance ?? null,
  };
}

async function decorate(regs: RegistrationDoc[]) {
  if (regs.length === 0) return { pass: new Map<string, PassDoc>(), att: new Map<string, AttendanceStatus>() };
  const [passes, atts] = await Promise.all([
    PassModel.find({ registrationId: { $in: regs.map((r) => r._id) } }).select({ registrationId: 1, status: 1 }).lean<PassDoc[]>(),
    AttendanceModel.find({ registrationId: { $in: regs.map((r) => r._id) } }).select({ registrationId: 1, status: 1 }).lean(),
  ]);
  return {
    pass: new Map(passes.map((p) => [p.registrationId, p])),
    att: new Map(atts.map((a) => [a.registrationId, a.status as AttendanceStatus])),
  };
}

function blockError(event: EventDoc) {
  const reason = registrationBlockReason(event) ?? "REGISTRATION_CLOSED";
  return errors.conflict(REGISTRATION_BLOCK_MESSAGES[reason], reason);
}

/**
 * Register the participant for an event. Seat reservation and the
 * registration write commit together; on a deployment without transactions
 * the seat is released again if the write fails.
 */
export async function registerForEvent(actor: SessionUser | null, eventId: string): Promise<MyRegistrationDTO> {
  assertParticipant(actor);
  await connectDB();
  await enforceRateLimit(`register:${actor.id}`, RATE_LIMITS.registrations);

  const [event, existing] = await Promise.all([
    eventRepository.findById(eventId),
    RegistrationModel.findOne({ eventId, userId: actor.id }).lean<RegistrationDoc>(),
  ]);
  if (!event || event.status === "draft") throw errors.notFound("Event");
  if (existing?.status === "registered") throw errors.conflict("You are already registered for this event", "ALREADY_REGISTERED");
  if (registrationBlockReason(event)) throw blockError(event);

  const isFree = event.priceMinor === 0;
  const now = new Date();
  const fields = {
    status: "registered" as const,
    paymentStatus: (isFree ? "approved" : "pending") as PaymentStatus,
    amountMinor: event.priceMinor,
    currency: event.currency,
    paymentMethod: isFree ? ("free" as const) : null,
    paymentReference: null,
    paymentNote: null,
    paymentProofMediaId: null,
    paymentSubmittedAt: null,
    paymentVerifiedBy: null,
    paymentVerifiedAt: isFree ? now : null,
    rejectionReason: null,
    refund: null,
    seatHeld: true,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
  };

  let outcome: { registration: RegistrationDoc; reserved: EventDoc; pass: PassDoc | null; passCreated: boolean };
  try {
    outcome = await withTransaction(async (session: TxSession) => {
      const reserved = await eventRepository.reserveSeat(eventId, now, session);
      if (!reserved) {
        const fresh = (await eventRepository.findById(eventId, { session })) ?? event;
        throw blockError(fresh);
      }
      try {
        let reg: RegistrationDoc | null;
        if (existing) {
          // Re-registration after cancellation/refund reuses the unique (eventId,userId) document.
          reg = await RegistrationModel.findOneAndUpdate(
            { _id: existing._id, status: { $in: ["cancelled", "refunded"] } },
            { $set: fields },
            { returnDocument: "after", session },
          ).lean<RegistrationDoc>();
          if (!reg) throw errors.conflict("You are already registered for this event", "ALREADY_REGISTERED");
        } else {
          const [created] = await RegistrationModel.create([{ eventId, userId: actor.id, ...fields }], { session });
          reg = created.toObject() as RegistrationDoc;
        }
        const issued = isFree ? await issuePassForRegistration(reg, null, session) : null;
        await recordAudit({ actor, action: "registration.create", entityType: "registration", entityId: reg._id, eventId, metadata: { amountMinor: reg.amountMinor, free: isFree } }, session);
        return { registration: reg, reserved, pass: issued?.pass ?? null, passCreated: issued?.created ?? false };
      } catch (err) {
        if (!session) await eventRepository.releaseSeat(eventId); // compensate without transactions
        throw err;
      }
    });
  } catch (err) {
    if (isDuplicateKeyError(err)) throw errors.conflict("You are already registered for this event", "ALREADY_REGISTERED");
    throw err;
  }

  const { registration, reserved, pass, passCreated } = outcome;
  await notify({
    userId: actor.id,
    type: "registration_confirmed",
    title: `Registered: ${event.title}`,
    body: isFree
      ? `You're registered for ${event.title}. Your QR pass is ready in My Passes.`
      : `You're registered for ${event.title}. Complete payment of ${formatMoney(event.priceMinor, event.currency)} and submit the payment details for verification.`,
    link: "/my-events",
    dedupeKey: `registration_confirmed:${registration._id}:${registration.updatedAt.getTime()}`,
  });
  if (passCreated) {
    await notify({ userId: actor.id, type: "pass_issued", title: `Your pass for ${event.title}`, body: "Your QR pass has been issued.", link: "/my-passes", dedupeKey: `pass_issued:${registration._id}` });
  }
  // Everything needed for the response is already in hand; no attendance exists yet.
  return { ...toRegistrationDTO(registration, pass, null), event: toEventSummary(reserved), paymentInstructions: reserved.paymentInstructions ?? null };
}

const cancelSchema = z.object({ reason: optionalTrimmed(1000) });

async function cancelRegistrationInternal(actor: SessionUser, registration: RegistrationDoc, reason: string | null, asAdmin: boolean) {
  return withTransaction(async (session) => {
    const updated = await RegistrationModel.findOneAndUpdate(
      { _id: registration._id, status: "registered", paymentStatus: { $ne: "approved" } },
      { $set: { status: "cancelled", seatHeld: false, cancelledAt: new Date(), cancelledBy: actor.id, cancellationReason: reason } },
      { returnDocument: "after", session },
    ).lean<RegistrationDoc>();
    if (!updated) throw errors.conflict("This registration can no longer be cancelled", "INVALID_STATE");
    if (registration.seatHeld) await eventRepository.releaseSeat(registration.eventId, session);
    await recordAudit({ actor, action: asAdmin ? "registration.admin_cancel" : "registration.cancel", entityType: "registration", entityId: registration._id, eventId: registration.eventId, metadata: { reason } }, session);
    return updated;
  });
}

export async function cancelMyRegistration(actor: SessionUser | null, registrationId: string): Promise<RegistrationDTO> {
  assertAuthenticated(actor);
  await connectDB();
  const reg = await RegistrationModel.findOne({ _id: registrationId, userId: actor.id }).lean<RegistrationDoc>();
  if (!reg) throw errors.notFound("Registration");
  if (!canCancelRegistration(reg)) throw errors.conflict("Approved registrations can only be cancelled by the organizers (refund)", "INVALID_STATE");
  return toRegistrationDTO(await cancelRegistrationInternal(actor, reg, null, false));
}

export async function adminCancelRegistration(actor: SessionUser | null, registrationId: string, rawInput: unknown): Promise<RegistrationDTO> {
  assertAdmin(actor);
  const { reason } = parseInput(cancelSchema, rawInput);
  await connectDB();
  const reg = await RegistrationModel.findById(registrationId).lean<RegistrationDoc>();
  if (!reg) throw errors.notFound("Registration");
  if (!canCancelRegistration(reg)) throw errors.conflict("Approved registrations must be refunded instead of cancelled", "INVALID_STATE");
  return toRegistrationDTO(await cancelRegistrationInternal(actor, reg, reason ?? null, true));
}

export async function getMyRegistrationForEvent(actor: SessionUser | null, eventId: string): Promise<MyRegistrationDTO | null> {
  assertAuthenticated(actor);
  await connectDB();
  const reg = await RegistrationModel.findOne({ eventId, userId: actor.id }).lean<RegistrationDoc>();
  if (!reg) return null;
  const [event, ctx] = await Promise.all([EventModel.findById(eventId, EVENT_SUMMARY_PROJECTION).lean<EventDoc>(), decorate([reg])]);
  return {
    ...toRegistrationDTO(reg, ctx.pass.get(reg._id), ctx.att.get(reg._id)),
    event: event ? toEventSummary(event) : null,
    paymentInstructions: event?.paymentInstructions ?? null,
  };
}

export async function listMyRegistrations(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<MyRegistrationDTO>> {
  assertAuthenticated(actor);
  const query = parseInput(paginationSchema, rawQuery);
  await connectDB();
  const filter = { userId: actor.id };
  const [regs, total] = await Promise.all([
    RegistrationModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<RegistrationDoc[]>(),
    RegistrationModel.countDocuments(filter),
  ]);
  const [events, ctx] = await Promise.all([EventModel.find({ _id: { $in: regs.map((r) => r.eventId) } }, EVENT_SUMMARY_PROJECTION).lean<EventDoc[]>(), decorate(regs)]);
  const byId = new Map(events.map((e) => [e._id, e]));
  return buildPage(
    regs.map((r) => {
      const e = byId.get(r.eventId);
      return {
        ...toRegistrationDTO(r, ctx.pass.get(r._id), ctx.att.get(r._id)),
        event: e && !e.deletedAt ? toEventSummary(e) : null,
        paymentInstructions: e?.paymentInstructions ?? null,
      };
    }),
    total,
    query,
  );
}

export const adminRegistrationQuerySchema = paginationSchema.extend({
  eventId: optionalBlank(z.uuid()),
  status: optionalBlank(z.enum(REGISTRATION_STATUSES)),
  paymentStatus: optionalBlank(z.enum(PAYMENT_STATUSES)),
});

export async function listRegistrations(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<AdminRegistrationDTO>> {
  assertAdmin(actor);
  const query = parseInput(adminRegistrationQuerySchema, rawQuery);
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (query.eventId) filter.eventId = query.eventId;
  if (query.status) filter.status = query.status;
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus;
  const sort: Record<string, 1 | -1> = query.paymentStatus === "submitted" ? { paymentSubmittedAt: 1 } : { createdAt: -1 };
  const [regs, total] = await Promise.all([
    RegistrationModel.find(filter).sort(sort).skip(toSkip(query)).limit(query.pageSize).lean<RegistrationDoc[]>(),
    RegistrationModel.countDocuments(filter),
  ]);
  return buildPage(await toAdminDTOs(regs), total, query);
}

export async function toAdminDTOs(regs: RegistrationDoc[]): Promise<AdminRegistrationDTO[]> {
  const [users, events, ctx] = await Promise.all([
    getUserSummaries(regs.map((r) => r.userId)),
    EventModel.find({ _id: { $in: Array.from(new Set(regs.map((r) => r.eventId))) } }).select({ title: 1 }).lean<Pick<EventDoc, "_id" | "title">[]>(),
    decorate(regs),
  ]);
  const titles = new Map(events.map((e) => [e._id, e.title]));
  return regs.map((r) => ({
    ...toRegistrationDTO(r, ctx.pass.get(r._id), ctx.att.get(r._id)),
    user: users.get(r.userId) ?? null,
    eventTitle: titles.get(r.eventId) ?? null,
    paymentProofUrl: r.paymentProofMediaId ? mediaContentUrl(r.paymentProofMediaId) : null,
    paymentVerifiedBy: r.paymentVerifiedBy ?? null,
    cancellationReason: r.cancellationReason ?? null,
  }));
}

export async function getAdminRegistration(actor: SessionUser | null, registrationId: string): Promise<AdminRegistrationDTO> {
  assertAdmin(actor);
  await connectDB();
  const reg = await RegistrationModel.findById(registrationId).lean<RegistrationDoc>();
  if (!reg) throw errors.notFound("Registration");
  return (await toAdminDTOs([reg]))[0];
}

/** Streams attendee rows for CSV export without loading the whole list in memory. */
export async function* iterateEventAttendees(actor: SessionUser | null, eventId: string): AsyncGenerator<AdminRegistrationDTO> {
  assertAdmin(actor);
  await connectDB();
  const cursor = RegistrationModel.find({ eventId }).sort({ createdAt: 1 }).lean<RegistrationDoc[]>().cursor({ batchSize: 200 });
  let batch: RegistrationDoc[] = [];
  for await (const reg of cursor as AsyncIterable<RegistrationDoc>) {
    batch.push(reg);
    if (batch.length === 200) {
      yield* await toAdminDTOs(batch);
      batch = [];
    }
  }
  if (batch.length) yield* await toAdminDTOs(batch);
}
