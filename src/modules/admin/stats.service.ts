import "server-only";
import { connectDB } from "@/lib/db";
import { countBy, sumCounts } from "@/lib/aggregate";
import { assertAdmin } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { EventModel, type EventDoc } from "@/modules/events/event.model";
import { RegistrationModel, type RegistrationDoc } from "@/modules/registrations/registration.model";
import { PassModel } from "@/modules/passes/pass.model";
import { AttendanceModel } from "@/modules/attendance/attendance.model";
import { EventMediaModel } from "@/modules/media/media.model";
import { CommentModel } from "@/modules/comments/comment.model";
import { FeedbackModel } from "@/modules/feedback/feedback.model";
import { toAdminDTOs, type AdminRegistrationDTO } from "@/modules/registrations/registration.service";
import { listCheckIns, type AttendanceDTO } from "@/modules/attendance/attendance.service";

export interface DashboardStats {
  events: { total: number; published: number; upcoming: number; cancelled: number; drafts: number };
  registrations: { total: number; active: number };
  payments: { pending: number; submitted: number; approved: number; rejected: number; refunded: number };
  passes: { active: number; revoked: number };
  attendance: { verified: number; pending: number };
  capacity: { seatsTaken: number; seatsTotal: number; utilization: number };
  moderation: { mediaPending: number; commentsFlagged: number; feedbackPending: number };
  topEvents: { id: string; title: string; registeredCount: number; capacity: number; startsAt: string }[];
  recentRegistrations: AdminRegistrationDTO[];
  recentDecisions: AdminRegistrationDTO[];
  recentCheckIns: AttendanceDTO[];
}


/** All totals are computed with database aggregations; no full collection is loaded into memory. */
export async function getDashboardStats(actor: SessionUser | null): Promise<DashboardStats> {
  assertAdmin(actor);
  await connectDB();
  const now = new Date();
  const liveEvents = { deletedAt: null };
  const [eventStatus, upcoming, payments, regStatus, passes, attendance, capacityAgg, mediaPending, commentsFlagged, feedbackPending, topEvents, recentRegs, recentDecided, recentCheckIns] = await Promise.all([
    countBy(EventModel, "status", liveEvents),
    EventModel.countDocuments({ ...liveEvents, status: "published", startsAt: { $gte: now } }),
    countBy(RegistrationModel, "paymentStatus"),
    countBy(RegistrationModel, "status"),
    countBy(PassModel, "status"),
    countBy(AttendanceModel, "status"),
    EventModel.aggregate<{ taken: number; total: number }>([{ $match: { ...liveEvents, status: "published" } }, { $group: { _id: null, taken: { $sum: "$registeredCount" }, total: { $sum: "$capacity" } } }]),
    EventMediaModel.countDocuments({ purpose: "gallery", moderationStatus: "pending", processingStatus: "ready", deletedAt: null }),
    CommentModel.countDocuments({ deletedAt: null, $or: [{ reportCount: { $gt: 0 } }, { moderationStatus: "pending" }] }),
    FeedbackModel.countDocuments({ status: "pending" }),
    EventModel.find({ ...liveEvents, status: "published", endsAt: { $gte: now } }).sort({ startsAt: 1 }).limit(8).select({ title: 1, registeredCount: 1, capacity: 1, startsAt: 1 }).lean<EventDoc[]>(),
    RegistrationModel.find({}).sort({ createdAt: -1 }).limit(8).lean<RegistrationDoc[]>(),
    RegistrationModel.find({ paymentVerifiedAt: { $ne: null }, paymentMethod: { $ne: "free" } }).sort({ paymentVerifiedAt: -1 }).limit(8).lean<RegistrationDoc[]>(),
    listCheckIns(actor, null, { page: 1, pageSize: 8 }),
  ]);
  const es = eventStatus;
  const cap = capacityAgg[0] ?? { taken: 0, total: 0 };
  // The two recent lists overlap; decorate the union once and split.
  const unique = Array.from(new Map([...recentRegs, ...recentDecided].map((r) => [r._id, r])).values());
  const decorated = new Map((await toAdminDTOs(unique)).map((d) => [d.id, d]));
  const recentRegistrations = recentRegs.map((r) => decorated.get(r._id)!);
  const recentDecisions = recentDecided.map((r) => decorated.get(r._id)!);
  return {
    events: { total: sumCounts(es), published: es.published ?? 0, upcoming, cancelled: es.cancelled ?? 0, drafts: es.draft ?? 0 },
    registrations: { total: sumCounts(regStatus), active: regStatus.registered ?? 0 },
    payments: { pending: payments.pending ?? 0, submitted: payments.submitted ?? 0, approved: payments.approved ?? 0, rejected: payments.rejected ?? 0, refunded: payments.refunded ?? 0 },
    passes: { active: passes.active ?? 0, revoked: passes.revoked ?? 0 },
    attendance: { verified: attendance.verified ?? 0, pending: attendance.pending_confirmation ?? 0 },
    capacity: { seatsTaken: cap.taken, seatsTotal: cap.total, utilization: cap.total ? cap.taken / cap.total : 0 },
    moderation: { mediaPending, commentsFlagged, feedbackPending },
    topEvents: topEvents.map((e) => ({ id: e._id, title: e.title, registeredCount: e.registeredCount, capacity: e.capacity, startsAt: e.startsAt.toISOString() })),
    recentRegistrations,
    recentDecisions,
    recentCheckIns: recentCheckIns.items,
  };
}

export interface EventStats {
  registrations: Partial<Record<string, number>>;
  payments: Partial<Record<string, number>>;
  passes: Partial<Record<string, number>>;
  attendance: Partial<Record<string, number>>;
  feedback: { average: number | null; count: number };
  media: { approved: number; pending: number };
}

export async function getEventStats(actor: SessionUser | null, eventId: string): Promise<EventStats> {
  assertAdmin(actor);
  await connectDB();
  const [registrations, payments, passes, attendance, fb, mediaApproved, mediaPending] = await Promise.all([
    countBy(RegistrationModel, "status", { eventId }),
    countBy(RegistrationModel, "paymentStatus", { eventId }),
    countBy(PassModel, "status", { eventId }),
    countBy(AttendanceModel, "status", { eventId }),
    FeedbackModel.aggregate<{ avg: number; n: number }>([{ $match: { eventId } }, { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]),
    EventMediaModel.countDocuments({ eventId, purpose: "gallery", moderationStatus: "approved", processingStatus: "ready", deletedAt: null }),
    EventMediaModel.countDocuments({ eventId, purpose: "gallery", moderationStatus: "pending", processingStatus: "ready", deletedAt: null }),
  ]);
  return {
    registrations,
    payments,
    passes,
    attendance,
    feedback: { average: fb[0] ? Math.round(fb[0].avg * 10) / 10 : null, count: fb[0]?.n ?? 0 },
    media: { approved: mediaApproved, pending: mediaPending },
  };
}

export interface AdminNavCounts {
  paymentsToVerify: number;
  mediaToReview: number;
  checkInsToConfirm: number;
}

/** Cheap indexed counts for the admin sidebar badges. */
export async function getAdminNavCounts(actor: SessionUser | null): Promise<AdminNavCounts> {
  assertAdmin(actor);
  await connectDB();
  const [paymentsToVerify, mediaToReview, checkInsToConfirm] = await Promise.all([
    RegistrationModel.countDocuments({ status: "registered", paymentStatus: "submitted" }),
    EventMediaModel.countDocuments({ purpose: "gallery", moderationStatus: "pending", processingStatus: "ready", deletedAt: null }),
    AttendanceModel.countDocuments({ status: "pending_confirmation" }),
  ]);
  return { paymentsToVerify, mediaToReview, checkInsToConfirm };
}
