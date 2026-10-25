import "server-only";
import { connectDB } from "@/lib/db";
import { errors } from "@/lib/errors";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { withTransaction } from "@/lib/transactions";
import { parseInput } from "@/lib/validation";
import { assertAuthenticated } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { EventModel, type EventDoc } from "@/modules/events/event.model";
import { EVENT_SUMMARY_PROJECTION, eventRepository } from "@/modules/events/event.repository";
import { toEventSummary, type EventSummaryDTO } from "@/modules/events/event.dto";
import { isPubliclyVisible } from "@/modules/events/event.policy";
import { EventInterestModel } from "./interest.model";

async function loadInterestableEvent(eventId: string): Promise<EventDoc> {
  const event = await eventRepository.findById(eventId);
  if (!event || !isPubliclyVisible(event)) throw errors.notFound("Event");
  if (event.status !== "published") throw errors.conflict("Interest can only be shown for upcoming events", "EVENT_NOT_OPEN");
  return event;
}

/**
 * Show interest (idempotent). Interest is a bookmark signal only: it never
 * reserves a seat or counts as a registration.
 */
export async function showInterest(actor: SessionUser | null, eventId: string): Promise<{ interested: true; interestCount: number }> {
  assertAuthenticated(actor);
  await connectDB();
  await loadInterestableEvent(eventId);
  await withTransaction(async (session) => {
    // Idempotent: a concurrent duplicate insert re-runs the unit, which then sees the record.
    if (await EventInterestModel.exists({ eventId, userId: actor.id }).session(session ?? null)) return;
    await EventInterestModel.create([{ eventId, userId: actor.id }], { session });
    await eventRepository.adjustInterestCount(eventId, 1, session);
  });
  return { interested: true, interestCount: await eventRepository.interestCount(eventId) };
}

export async function removeInterest(actor: SessionUser | null, eventId: string): Promise<{ interested: false; interestCount: number }> {
  assertAuthenticated(actor);
  await connectDB();
  await withTransaction(async (session) => {
    const res = await EventInterestModel.deleteOne({ eventId, userId: actor.id }, { session });
    if (res.deletedCount === 1) await eventRepository.adjustInterestCount(eventId, -1, session);
  });
  return { interested: false, interestCount: await eventRepository.interestCount(eventId) };
}

export async function isInterested(userId: string, eventId: string): Promise<boolean> {
  await connectDB();
  return (await EventInterestModel.exists({ eventId, userId })) !== null;
}

/** Which of `eventIds` the user has shown interest in (one query for a whole card grid). */
export async function interestedEventIds(userId: string, eventIds: string[]): Promise<Set<string>> {
  if (eventIds.length === 0) return new Set();
  await connectDB();
  const rows = await EventInterestModel.find({ userId, eventId: { $in: eventIds } }, { eventId: 1 }).lean();
  return new Set(rows.map((r) => String(r.eventId)));
}

export async function listMyInterests(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<EventSummaryDTO>> {
  assertAuthenticated(actor);
  const query = parseInput(paginationSchema, rawQuery);
  await connectDB();
  const filter = { userId: actor.id };
  const [rows, total] = await Promise.all([
    EventInterestModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean(),
    EventInterestModel.countDocuments(filter),
  ]);
  const events = await EventModel.find({ _id: { $in: rows.map((r) => r.eventId) }, deletedAt: null }, EVENT_SUMMARY_PROJECTION).lean<EventDoc[]>();
  const byId = new Map(events.map((e) => [e._id, e]));
  const items = rows.map((r) => byId.get(r.eventId)).filter((e): e is EventDoc => !!e && isPubliclyVisible(e)).map(toEventSummary);
  return buildPage(items, total, query);
}
