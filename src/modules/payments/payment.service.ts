import "server-only";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { errors } from "@/lib/errors";
import { withTransaction } from "@/lib/transactions";
import { optionalTrimmed, parseInput, optionalBlank } from "@/lib/validation";
import { assertAdmin, assertAuthenticated } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { eventRepository } from "@/modules/events/event.repository";
import { EventMediaModel } from "@/modules/media/media.model";
import { PassModel } from "@/modules/passes/pass.model";
import { issuePassForRegistration } from "@/modules/passes/pass.service";
import { AttendanceModel } from "@/modules/attendance/attendance.model";
import { notify, notifyMany } from "@/modules/notifications/notification.service";
import { RegistrationModel, type RegistrationDoc } from "@/modules/registrations/registration.model";
import { SUBMITTABLE_PAYMENT_METHODS } from "@/modules/registrations/registration.constants";
import { canApprovePayment, canRefundPayment, canRejectPayment, canSubmitPayment } from "@/modules/registrations/registration.policy";
import { getAdminRegistration, getMyRegistrationForEvent, toAdminDTOs, type AdminRegistrationDTO, type MyRegistrationDTO } from "@/modules/registrations/registration.service";

export const submitPaymentSchema = z.object({
  method: z.enum(SUBMITTABLE_PAYMENT_METHODS),
  reference: z.string().trim().min(3, "Enter the transaction / UTR reference").max(120),
  note: optionalTrimmed(1000),
  proofMediaId: optionalBlank(z.uuid()),
});

/**
 * Participant submits payment evidence. This only moves the payment to
 * "submitted": evidence (including a screenshot) never approves anything.
 */
export async function submitPayment(actor: SessionUser | null, registrationId: string, rawInput: unknown): Promise<MyRegistrationDTO> {
  assertAuthenticated(actor);
  const input = parseInput(submitPaymentSchema, rawInput);
  await connectDB();
  const reg = await RegistrationModel.findOne({ _id: registrationId, userId: actor.id }).lean<RegistrationDoc>();
  if (!reg) throw errors.notFound("Registration");
  if (!canSubmitPayment(reg)) throw errors.conflict("Payment details cannot be submitted for this registration", "INVALID_STATE");
  const event = await eventRepository.findById(reg.eventId);
  if (!event || event.status === "cancelled") throw errors.conflict("This event is no longer accepting payments", "EVENT_CANCELLED");

  if (input.proofMediaId) {
    const proof = await EventMediaModel.findOne({
      _id: input.proofMediaId,
      purpose: "payment_proof",
      registrationId: reg._id,
      uploaderId: actor.id,
      deletedAt: null,
    }).lean();
    if (!proof) throw errors.unprocessable("Unknown payment proof", "INVALID_PROOF", { proofMediaId: ["Upload the proof again"] });
    if (proof.processingStatus !== "ready") throw errors.unprocessable("The payment proof is still processing", "PROOF_NOT_READY");
  }

  const submittedAt = new Date();
  const updated = await withTransaction(async (session) => {
    const doc = await RegistrationModel.findOneAndUpdate(
      { _id: reg._id, status: "registered", paymentStatus: { $in: ["pending", "submitted", "rejected"] } },
      {
        $set: {
          paymentStatus: "submitted",
          paymentMethod: input.method,
          paymentReference: input.reference,
          paymentNote: input.note ?? null,
          paymentProofMediaId: input.proofMediaId ?? reg.paymentProofMediaId ?? null,
          paymentSubmittedAt: submittedAt,
          rejectionReason: null,
        },
      },
      { returnDocument: "after", session },
    ).lean<RegistrationDoc>();
    if (!doc) throw errors.conflict("The registration changed; reload and try again", "CONCURRENT_UPDATE");
    await recordAudit({ actor, action: "payment.submit", entityType: "registration", entityId: reg._id, eventId: reg.eventId, metadata: { method: input.method } }, session);
    return doc;
  });

  await notify({
    userId: actor.id,
    type: "payment_submitted",
    title: `Payment submitted: ${event.title}`,
    body: "We received your payment details. An organizer will verify them shortly.",
    link: "/my-events",
    dedupeKey: `payment_submitted:${updated._id}:${submittedAt.getTime()}`,
  });
  return (await getMyRegistrationForEvent(actor, reg.eventId))!;
}

export const approvePaymentSchema = z.object({ note: optionalTrimmed(500) });

export interface ApprovalResult {
  registration: AdminRegistrationDTO;
  passId: string;
  /** True when the registration was already approved (repeated request). */
  alreadyApproved: boolean;
}

/**
 * Approve a payment and issue the pass atomically. Idempotent: repeating the
 * request returns the existing pass. Without transactions, an interrupted
 * approval leaves "approved without pass", which the next approve call or the
 * maintenance reconciliation (reconcileMissingPasses) completes.
 */
export async function approvePayment(actor: SessionUser | null, registrationId: string, rawInput: unknown = {}): Promise<ApprovalResult> {
  assertAdmin(actor);
  const { note } = parseInput(approvePaymentSchema, rawInput);
  await connectDB();

  const outcome = await withTransaction(async (session) => {
    const current = await RegistrationModel.findById(registrationId).session(session ?? null).lean<RegistrationDoc>();
    if (!current) throw errors.notFound("Registration");

    if (current.status === "registered" && current.paymentStatus === "approved") {
      const { pass } = await issuePassForRegistration(current, actor.id, session);
      return { registration: current, pass, alreadyApproved: true, eventTitle: null };
    }
    if (!canApprovePayment(current)) {
      throw errors.conflict(`A ${current.status}/${current.paymentStatus} registration cannot be approved`, "INVALID_STATE");
    }
    const event = await eventRepository.findById(current.eventId, { session });
    if (!event || event.status === "cancelled") throw errors.conflict("The event is cancelled; payments cannot be approved", "EVENT_CANCELLED");

    const approved = await RegistrationModel.findOneAndUpdate(
      { _id: registrationId, status: "registered", paymentStatus: current.paymentStatus },
      { $set: { paymentStatus: "approved", paymentVerifiedBy: actor.id, paymentVerifiedAt: new Date(), rejectionReason: null } },
      { returnDocument: "after", session },
    ).lean<RegistrationDoc>();
    if (!approved) throw errors.conflict("The registration changed concurrently; retry", "CONCURRENT_UPDATE");

    const { pass } = await issuePassForRegistration(approved, actor.id, session);
    await recordAudit(
      { actor, action: "payment.approve", entityType: "registration", entityId: registrationId, eventId: approved.eventId, metadata: { passId: pass._id, amountMinor: approved.amountMinor, reference: approved.paymentReference, note } },
      session,
    );
    return { registration: approved, pass, alreadyApproved: false, eventTitle: event.title };
  });

  if (!outcome.alreadyApproved) {
    const title = outcome.eventTitle ?? "your event";
    const userId = outcome.registration.userId;
    await notifyMany([
      { userId, type: "payment_approved", title: `Payment approved: ${title}`, body: `Your payment for ${title} has been verified.`, link: "/my-passes", dedupeKey: `payment_approved:${registrationId}` },
      { userId, type: "pass_issued", title: `Your pass for ${title}`, body: "Your QR pass is ready. Show it at the venue entrance.", link: "/my-passes", dedupeKey: `pass_issued:${registrationId}` },
    ]);
  }
  const [registration] = await toAdminDTOs([outcome.registration]);
  return { registration, passId: outcome.pass._id, alreadyApproved: outcome.alreadyApproved };
}

export const rejectPaymentSchema = z.object({ reason: z.string().trim().min(3, "Give the participant a reason").max(1000) });

export async function rejectPayment(actor: SessionUser | null, registrationId: string, rawInput: unknown): Promise<AdminRegistrationDTO> {
  assertAdmin(actor);
  const { reason } = parseInput(rejectPaymentSchema, rawInput);
  await connectDB();
  const current = await RegistrationModel.findById(registrationId).lean<RegistrationDoc>();
  if (!current) throw errors.notFound("Registration");
  if (!canRejectPayment(current)) throw errors.conflict(`A ${current.paymentStatus} payment cannot be rejected`, "INVALID_STATE");
  const decidedAt = new Date();
  await withTransaction(async (session) => {
    const doc = await RegistrationModel.findOneAndUpdate(
      { _id: registrationId, status: "registered", paymentStatus: current.paymentStatus },
      { $set: { paymentStatus: "rejected", rejectionReason: reason, paymentVerifiedBy: actor.id, paymentVerifiedAt: decidedAt } },
      { returnDocument: "after", session },
    ).lean<RegistrationDoc>();
    if (!doc) throw errors.conflict("The registration changed concurrently; retry", "CONCURRENT_UPDATE");
    await recordAudit({ actor, action: "payment.reject", entityType: "registration", entityId: registrationId, eventId: doc.eventId, metadata: { reason } }, session);
  });
  const event = await eventRepository.findById(current.eventId);
  await notify({
    userId: current.userId,
    type: "payment_rejected",
    title: `Payment not verified: ${event?.title ?? "event"}`,
    body: `We could not verify your payment. Reason: ${reason}. You can submit corrected details from My Events.`,
    link: "/my-events",
    dedupeKey: `payment_rejected:${registrationId}:${decidedAt.getTime()}`,
  });
  return getAdminRegistration(actor, registrationId);
}

export const refundSchema = z.object({
  reason: z.string().trim().min(3).max(1000),
  amountMinor: optionalBlank(z.coerce.number().int().min(0)),
});

/** Record an offline refund: releases the seat, revokes the pass and any attendance. */
export async function refundPayment(actor: SessionUser | null, registrationId: string, rawInput: unknown): Promise<AdminRegistrationDTO> {
  assertAdmin(actor);
  const input = parseInput(refundSchema, rawInput);
  await connectDB();
  const current = await RegistrationModel.findById(registrationId).lean<RegistrationDoc>();
  if (!current) throw errors.notFound("Registration");
  if (!canRefundPayment(current)) throw errors.conflict("Only approved payments can be refunded", "INVALID_STATE");
  const amount = input.amountMinor ?? current.amountMinor;
  if (amount > current.amountMinor) throw errors.unprocessable("Refund cannot exceed the amount paid", "REFUND_TOO_LARGE");
  const now = new Date();
  await withTransaction(async (session) => {
    const doc = await RegistrationModel.findOneAndUpdate(
      { _id: registrationId, status: "registered", paymentStatus: "approved" },
      { $set: { status: "refunded", paymentStatus: "refunded", seatHeld: false, refund: { refundedAt: now, refundedBy: actor.id, reason: input.reason, amountMinor: amount } } },
      { returnDocument: "after", session },
    ).lean<RegistrationDoc>();
    if (!doc) throw errors.conflict("The registration changed concurrently; retry", "CONCURRENT_UPDATE");
    if (current.seatHeld) await eventRepository.releaseSeat(current.eventId, session);
    const revoked = { status: "revoked", revokedAt: now, revokedBy: actor.id, revocationReason: "Payment refunded" } as const;
    await PassModel.updateOne({ registrationId, status: "active" }, { $set: revoked }, { session });
    await AttendanceModel.updateOne({ registrationId, status: { $ne: "revoked" } }, { $set: revoked }, { session });
    await recordAudit({ actor, action: "payment.refund", entityType: "registration", entityId: registrationId, eventId: current.eventId, metadata: { amountMinor: amount, reason: input.reason } }, session);
  });
  await notify({
    userId: current.userId,
    type: "payment_refunded",
    title: "Refund recorded",
    body: `A refund of ${formatMoney(amount, current.currency)} was recorded for your registration. Your pass is no longer valid.`,
    link: "/my-events",
    dedupeKey: `payment_refunded:${registrationId}`,
  });
  return getAdminRegistration(actor, registrationId);
}

