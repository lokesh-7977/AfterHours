import "server-only";
import QRCode from "qrcode";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { decryptSecret, encryptSecret, randomToken, sha256Hex } from "@/lib/crypto";
import { errors, isDuplicateKeyError } from "@/lib/errors";
import { withTransaction, type TxSession } from "@/lib/transactions";
import { parseInput } from "@/lib/validation";
import { assertAdmin, assertAuthenticated, assertOwnerOrAdmin } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { EventModel, type EventDoc } from "@/modules/events/event.model";
import { EVENT_SUMMARY_PROJECTION } from "@/modules/events/event.repository";
import { toEventSummary, type EventSummaryDTO } from "@/modules/events/event.dto";
import { RegistrationModel, type RegistrationDoc } from "@/modules/registrations/registration.model";
import { isPassEligible } from "@/modules/registrations/registration.policy";
import { AttendanceModel, type AttendanceStatus } from "@/modules/attendance/attendance.model";
import { notify } from "@/modules/notifications/notification.service";
import { PassModel, type PassDoc, type PassStatus } from "./pass.model";
import { PASS_INVALID_MESSAGES, QR_PAYLOAD_PREFIX, passInvalidReason, type PassInvalidReason } from "./pass.policy";

const TOKEN_PURPOSE = "pass-token";

function mintToken() {
  const token = randomToken(32);
  return { token, tokenHash: sha256Hex(token), tokenCiphertext: encryptSecret(TOKEN_PURPOSE, token) };
}

export function hashPassToken(token: string): string {
  return sha256Hex(token);
}

/**
 * Issue (or re-activate) the pass for an approved registration. Idempotent:
 * the unique registrationId index guarantees a single pass, and a concurrent
 * duplicate insert resolves to the existing document.
 */
export async function issuePassForRegistration(
  registration: Pick<RegistrationDoc, "_id" | "eventId" | "userId" | "status" | "paymentStatus">,
  issuedBy: string | null,
  session?: TxSession,
): Promise<{ pass: PassDoc; created: boolean }> {
  if (!isPassEligible(registration)) {
    throw errors.conflict("A pass can only be issued for an approved, active registration", "NOT_ELIGIBLE");
  }
  const existing = await PassModel.findOne({ registrationId: registration._id }).session(session ?? null).lean<PassDoc>();
  if (existing?.status === "active") return { pass: existing, created: false };
  if (existing) {
    // A previously revoked pass is re-activated with a fresh token (old QR stays invalid).
    const reactivated = await PassModel.findOneAndUpdate(
      { _id: existing._id, status: "revoked" },
      { $set: { ...mintToken(), status: "active", rotatedAt: new Date(), revokedAt: null, revokedBy: null, revocationReason: null, issuedBy } },
      { returnDocument: "after", session },
    ).lean<PassDoc>();
    return { pass: reactivated ?? existing, created: Boolean(reactivated) };
  }
  // A concurrent insert loses on the unique registrationId index; its duplicate-key
  // error re-runs the enclosing unit (withTransaction), which then finds the winner above.
  const [created] = await PassModel.create(
    [{ registrationId: registration._id, eventId: registration.eventId, userId: registration.userId, ...mintToken(), status: "active", issuedAt: new Date(), issuedBy }],
    { session },
  );
  return { pass: created.toObject() as PassDoc, created: true };
}

export interface PassDTO {
  id: string;
  registrationId: string;
  status: PassStatus;
  issuedAt: string;
  revokedAt: string | null;
  revocationReason: string | null;
  event: EventSummaryDTO | null;
  attendanceStatus: AttendanceStatus | null;
  /** Whether the pass would currently be accepted (ignoring the check-in time window). */
  usable: boolean;
  invalidReason: PassInvalidReason | null;
}

function toPassDTO(pass: PassDoc, registration: RegistrationDoc | null, event: EventDoc | null, attendanceStatus: AttendanceStatus | null): PassDTO {
  const reason = passInvalidReason({ pass, registration, event });
  return {
    id: pass._id,
    registrationId: pass.registrationId,
    status: pass.status,
    issuedAt: pass.issuedAt.toISOString(),
    revokedAt: pass.revokedAt?.toISOString() ?? null,
    revocationReason: pass.revocationReason ?? null,
    event: event ? toEventSummary(event) : null,
    attendanceStatus,
    usable: reason === null,
    invalidReason: reason,
  };
}

async function loadContext(passes: PassDoc[]) {
  const [registrations, events, attendances] = await Promise.all([
    RegistrationModel.find({ _id: { $in: passes.map((p) => p.registrationId) } }).lean<RegistrationDoc[]>(),
    EventModel.find({ _id: { $in: passes.map((p) => p.eventId) } }, EVENT_SUMMARY_PROJECTION).lean<EventDoc[]>(),
    AttendanceModel.find({ $or: passes.map((p) => ({ eventId: p.eventId, userId: p.userId })) }).lean(),
  ]);
  return {
    reg: new Map(registrations.map((r) => [r._id, r])),
    event: new Map(events.map((e) => [e._id, e])),
    att: new Map(attendances.map((a) => [`${a.eventId}:${a.userId}`, a.status])),
  };
}

export async function listMyPasses(actor: SessionUser | null): Promise<PassDTO[]> {
  assertAuthenticated(actor);
  await connectDB();
  const passes = await PassModel.find({ userId: actor.id }).sort({ issuedAt: -1 }).limit(200).lean<PassDoc[]>();
  if (passes.length === 0) return [];
  const ctx = await loadContext(passes);
  return passes.map((p) => toPassDTO(p, ctx.reg.get(p.registrationId) ?? null, ctx.event.get(p.eventId) ?? null, ctx.att.get(`${p.eventId}:${p.userId}`) ?? null));
}

async function loadAccessiblePass(actor: SessionUser | null, passId: string): Promise<{ pass: PassDoc; dto: PassDTO }> {
  assertAuthenticated(actor);
  await connectDB();
  const pass = await PassModel.findById(passId).lean<PassDoc>();
  if (!pass) throw errors.notFound("Pass");
  assertOwnerOrAdmin(actor, pass.userId); // non-owners get 404 to avoid confirming existence
  const ctx = await loadContext([pass]);
  const dto = toPassDTO(pass, ctx.reg.get(pass.registrationId) ?? null, ctx.event.get(pass.eventId) ?? null, ctx.att.get(`${pass.eventId}:${pass.userId}`) ?? null);
  return { pass, dto };
}

export async function getPass(actor: SessionUser | null, passId: string): Promise<PassDTO> {
  return (await loadAccessiblePass(actor, passId)).dto;
}

/**
 * QR image for the pass owner (or an admin). Rendered only while the pass is
 * usable, so no active-looking QR exists before approval or after revocation.
 */
export async function getPassQrDataUrl(actor: SessionUser | null, passId: string): Promise<{ qrDataUrl: string; pass: PassDTO }> {
  const { pass, dto } = await loadAccessiblePass(actor, passId);
  if (!dto.usable) throw errors.conflict(dto.invalidReason ? PASS_INVALID_MESSAGES[dto.invalidReason] : "Pass unavailable", dto.invalidReason ?? "PASS_UNUSABLE");
  const token = decryptSecret(TOKEN_PURPOSE, pass.tokenCiphertext);
  const qrDataUrl = await QRCode.toDataURL(`${QR_PAYLOAD_PREFIX}${token}`, { errorCorrectionLevel: "M", margin: 2, width: 360 });
  return { qrDataUrl, pass: dto };
}

const revokeSchema = z.object({ reason: z.string().trim().min(3).max(500) });

export async function revokePass(actor: SessionUser | null, passId: string, rawInput: unknown): Promise<PassDTO> {
  assertAdmin(actor);
  const { reason } = parseInput(revokeSchema, rawInput);
  await connectDB();
  const pass = await withTransaction(async (session) => {
    const updated = await PassModel.findOneAndUpdate(
      { _id: passId, status: "active" },
      { $set: { status: "revoked", revokedAt: new Date(), revokedBy: actor.id, revocationReason: reason } },
      { returnDocument: "after", session },
    ).lean<PassDoc>();
    if (!updated) {
      const exists = await PassModel.exists({ _id: passId }).session(session ?? null);
      if (!exists) throw errors.notFound("Pass");
      throw errors.conflict("The pass is already revoked", "ALREADY_REVOKED");
    }
    await recordAudit({ actor, action: "pass.revoke", entityType: "pass", entityId: passId, eventId: updated.eventId, metadata: { reason } }, session);
    return updated;
  });
  await notify({
    userId: pass.userId,
    type: "pass_revoked",
    title: "Your event pass was revoked",
    body: `Your pass has been revoked. Reason: ${reason}`,
    link: "/my-passes",
    dedupeKey: `pass_revoked:${pass._id}:${pass.revokedAt?.getTime()}`,
  });
  return getPass(actor, passId);
}

/** Rotate the token (old QR becomes invalid) and re-activate if the registration is still eligible. */
export async function reissuePass(actor: SessionUser | null, passId: string): Promise<PassDTO> {
  assertAdmin(actor);
  await connectDB();
  await withTransaction(async (session) => {
    const pass = await PassModel.findById(passId).session(session ?? null).lean<PassDoc>();
    if (!pass) throw errors.notFound("Pass");
    const registration = await RegistrationModel.findById(pass.registrationId).session(session ?? null).lean<RegistrationDoc>();
    if (!registration || !isPassEligible(registration)) throw errors.conflict("The registration is not eligible for a pass", "NOT_ELIGIBLE");
    await PassModel.updateOne(
      { _id: passId },
      { $set: { ...mintToken(), status: "active", rotatedAt: new Date(), revokedAt: null, revokedBy: null, revocationReason: null } },
      { session },
    );
    await recordAudit({ actor, action: "pass.reissue", entityType: "pass", entityId: passId, eventId: pass.eventId }, session);
  });
  return getPass(actor, passId);
}

export async function findPassByToken(token: string): Promise<PassDoc | null> {
  await connectDB();
  return PassModel.findOne({ tokenHash: hashPassToken(token) }).lean<PassDoc>();
}

/**
 * Recovery for deployments without transactions: an approved registration
 * whose pass insert was interrupted gets its pass here (idempotent).
 */
export async function reconcileMissingPasses(limit = 500): Promise<number> {
  await connectDB();
  const approved = await RegistrationModel.find({ status: "registered", paymentStatus: "approved" }).select({ _id: 1, eventId: 1, userId: 1, status: 1, paymentStatus: 1, paymentVerifiedBy: 1 }).sort({ updatedAt: -1 }).limit(limit * 4).lean<RegistrationDoc[]>();
  if (approved.length === 0) return 0;
  // Any existing pass (including one an admin deliberately revoked) is left alone.
  const withPass = new Set((await PassModel.find({ registrationId: { $in: approved.map((r) => r._id) } }).select({ registrationId: 1 }).lean()).map((p) => p.registrationId));
  const missing = approved.filter((r) => !withPass.has(r._id)).slice(0, limit);
  if (missing.length === 0) return 0;
  try {
    const docs = await PassModel.insertMany(
      missing.map((r) => ({ registrationId: r._id, eventId: r.eventId, userId: r.userId, ...mintToken(), status: "active", issuedAt: new Date(), issuedBy: r.paymentVerifiedBy ?? null })),
      { ordered: false },
    );
    return docs.length;
  } catch (err) {
    // ordered:false inserts every non-duplicate; a concurrent approval may have created some passes meanwhile.
    if (!isDuplicateKeyError(err)) throw err;
    return (err as { insertedDocs?: unknown[] }).insertedDocs?.length ?? 0;
  }
}
