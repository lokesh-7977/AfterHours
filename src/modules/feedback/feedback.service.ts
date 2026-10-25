import "server-only";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { errors } from "@/lib/errors";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { withTransaction } from "@/lib/transactions";
import { optionalTrimmed, parseInput, optionalBlank } from "@/lib/validation";
import { assertAdmin, assertParticipant } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { eventRepository } from "@/modules/events/event.repository";
import { isVerifiedAttendee } from "@/modules/attendance/attendance.service";
import { getUserSummaries } from "@/modules/users/user.service";
import { FEEDBACK_STATUSES, FeedbackModel, type FeedbackDoc, type FeedbackStatus } from "./feedback.model";

export const feedbackSchema = z.object({
  rating: z.coerce.number().int().min(1, "Choose 1–5 stars").max(5),
  body: optionalTrimmed(3000),
});

export type FeedbackIneligibleReason = "NOT_ATTENDEE" | "EVENT_NOT_STARTED" | "EVENT_CANCELLED";

/** Pure eligibility rule: verified attendees, once the event has started, for non-cancelled events. */
export function feedbackIneligibleReason(opts: { verifiedAttendee: boolean; eventStatus: string; startsAt: Date; now?: Date }): FeedbackIneligibleReason | null {
  if (opts.eventStatus === "cancelled") return "EVENT_CANCELLED";
  if (!opts.verifiedAttendee) return "NOT_ATTENDEE";
  if ((opts.now ?? new Date()) < opts.startsAt) return "EVENT_NOT_STARTED";
  return null;
}

const INELIGIBLE_MESSAGES: Record<FeedbackIneligibleReason, string> = {
  NOT_ATTENDEE: "Only verified attendees can leave feedback",
  EVENT_NOT_STARTED: "Feedback opens once the event starts",
  EVENT_CANCELLED: "Feedback is closed for cancelled events",
};

export interface MyFeedbackDTO {
  id: string;
  rating: number;
  body: string | null;
  status: FeedbackStatus;
  updatedAt: string;
}

/**
 * One record per participant per event. Re-submitting is an explicit
 * revision: it updates the same record, increments revisionCount and sends
 * it back to moderation.
 */
export async function submitFeedback(actor: SessionUser | null, eventId: string, rawInput: unknown): Promise<MyFeedbackDTO> {
  assertParticipant(actor);
  const input = parseInput(feedbackSchema, rawInput);
  await connectDB();
  const event = await eventRepository.getOrThrow(eventId);
  const reason = feedbackIneligibleReason({ verifiedAttendee: await isVerifiedAttendee(actor.id, eventId), eventStatus: event.status, startsAt: event.startsAt });
  if (reason) throw errors.forbidden(INELIGIBLE_MESSAGES[reason]);

  const doc = await withTransaction(async (session) => {
    const saved = await FeedbackModel.findOneAndUpdate(
      { eventId, userId: actor.id },
      {
        $set: { rating: input.rating, body: input.body ?? null, status: "pending", moderatedBy: null, moderatedAt: null },
        $setOnInsert: { eventId, userId: actor.id, revisionCount: 0, adminNote: null },
      },
      { upsert: true, returnDocument: "after", session },
    ).lean<FeedbackDoc>();
    if (saved && saved.createdAt.getTime() !== saved.updatedAt.getTime()) {
      await FeedbackModel.updateOne({ _id: saved._id }, { $inc: { revisionCount: 1 } }, { session });
    }
    return saved!;
  });
  return toMyFeedbackDTO(doc);
}

function toMyFeedbackDTO(doc: FeedbackDoc): MyFeedbackDTO {
  return { id: doc._id, rating: doc.rating, body: doc.body, status: doc.status, updatedAt: doc.updatedAt.toISOString() };
}

export async function getMyFeedback(userId: string, eventId: string): Promise<MyFeedbackDTO | null> {
  await connectDB();
  const doc = await FeedbackModel.findOne({ eventId, userId }).lean<FeedbackDoc>();
  return doc ? toMyFeedbackDTO(doc) : null;
}

export interface PublicFeedbackSummary {
  averageRating: number | null;
  count: number;
  recent: { rating: number; body: string | null; author: string; createdAt: string }[];
}

/** Public view: approved feedback only; admin notes are never included. */
export async function getPublicFeedbackSummary(eventId: string): Promise<PublicFeedbackSummary> {
  await connectDB();
  const [agg, recent] = await Promise.all([
    FeedbackModel.aggregate<{ avg: number; n: number }>([{ $match: { eventId, status: "approved" } }, { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]),
    FeedbackModel.find({ eventId, status: "approved", body: { $ne: null } }).sort({ createdAt: -1 }).limit(5).select({ rating: 1, body: 1, userId: 1, createdAt: 1 }).lean<FeedbackDoc[]>(),
  ]);
  const users = await getUserSummaries(recent.map((r) => r.userId));
  return {
    averageRating: agg[0] ? Math.round(agg[0].avg * 10) / 10 : null,
    count: agg[0]?.n ?? 0,
    recent: recent.map((r) => ({ rating: r.rating, body: r.body, author: users.get(r.userId)?.name.split(" ")[0] ?? "Attendee", createdAt: r.createdAt.toISOString() })),
  };
}

export const adminFeedbackQuerySchema = paginationSchema.extend({
  eventId: optionalBlank(z.uuid()),
  status: optionalBlank(z.enum(FEEDBACK_STATUSES)),
});

export interface AdminFeedbackDTO {
  id: string;
  eventId: string;
  user: { name: string; email: string } | null;
  rating: number;
  body: string | null;
  status: FeedbackStatus;
  adminNote: string | null;
  revisionCount: number;
  createdAt: string;
}

export async function listFeedback(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<AdminFeedbackDTO> & { stats: { average: number | null; count: number; distribution: Record<number, number> } }> {
  assertAdmin(actor);
  const query = parseInput(adminFeedbackQuerySchema, rawQuery);
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (query.eventId) filter.eventId = query.eventId;
  if (query.status) filter.status = query.status;
  const statsMatch = query.eventId ? { eventId: query.eventId } : {};
  const [docs, total, dist] = await Promise.all([
    FeedbackModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<FeedbackDoc[]>(),
    FeedbackModel.countDocuments(filter),
    FeedbackModel.aggregate<{ _id: number; n: number }>([{ $match: statsMatch }, { $group: { _id: "$rating", n: { $sum: 1 } } }]),
  ]);
  const users = await getUserSummaries(docs.map((d) => d.userId));
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  let count = 0;
  for (const d of dist) {
    distribution[d._id] = d.n;
    sum += d._id * d.n;
    count += d.n;
  }
  return {
    ...buildPage(
      docs.map((d) => {
        const u = users.get(d.userId);
        return { id: d._id, eventId: d.eventId, user: u ? { name: u.name, email: u.email } : null, rating: d.rating, body: d.body, status: d.status, adminNote: d.adminNote, revisionCount: d.revisionCount, createdAt: d.createdAt.toISOString() };
      }),
      total,
      query,
    ),
    stats: { average: count ? Math.round((sum / count) * 10) / 10 : null, count, distribution },
  };
}

export const moderateFeedbackSchema = z.object({ decision: z.enum(["approved", "rejected"]), adminNote: optionalTrimmed(1000) });

export async function moderateFeedback(actor: SessionUser | null, feedbackId: string, rawInput: unknown): Promise<void> {
  assertAdmin(actor);
  const input = parseInput(moderateFeedbackSchema, rawInput);
  await connectDB();
  await withTransaction(async (session) => {
    const res = await FeedbackModel.updateOne(
      { _id: feedbackId },
      { $set: { status: input.decision, moderatedBy: actor.id, moderatedAt: new Date(), ...(input.adminNote !== undefined ? { adminNote: input.adminNote } : {}) } },
      { session },
    );
    if (res.matchedCount === 0) throw errors.notFound("Feedback");
    await recordAudit({ actor, action: `feedback.${input.decision === "approved" ? "approve" : "reject"}`, entityType: "feedback", entityId: feedbackId }, session);
  });
}
