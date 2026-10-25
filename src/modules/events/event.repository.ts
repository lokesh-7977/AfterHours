import "server-only";
import { errors } from "@/lib/errors";
import type { TxSession } from "@/lib/transactions";
import { EventModel, type EventDoc } from "./event.model";

/** Projection for list/summary reads: drops the description (up to 20 KB), which summaries never use. */
export const EVENT_SUMMARY_PROJECTION = { description: 0 } as const;

type FindOpts = { includeDeleted?: boolean; session?: TxSession };

export const eventRepository = {
  async findById(id: string, opts: FindOpts = {}): Promise<EventDoc | null> {
    const filter: Record<string, unknown> = { _id: id };
    if (!opts.includeDeleted) filter.deletedAt = null;
    return EventModel.findOne(filter).session(opts.session ?? null).lean<EventDoc>();
  },

  /** `findById` that throws the standard 404 when the event is missing or deleted. */
  async getOrThrow(id: string, opts: FindOpts = {}): Promise<EventDoc> {
    const event = await eventRepository.findById(id, opts);
    if (!event) throw errors.notFound("Event");
    return event;
  },

  async interestCount(id: string): Promise<number> {
    const doc = await EventModel.findById(id).select({ interestCount: 1 }).lean<Pick<EventDoc, "interestCount">>();
    return doc?.interestCount ?? 0;
  },

  async findBySlug(slug: string): Promise<EventDoc | null> {
    return EventModel.findOne({ slug, deletedAt: null }).lean<EventDoc>();
  },

  async slugExists(slug: string, exceptId?: string): Promise<boolean> {
    const filter: Record<string, unknown> = { slug };
    if (exceptId) filter._id = { $ne: exceptId };
    return (await EventModel.exists(filter)) !== null;
  },

  async insert(doc: Partial<EventDoc>, session?: TxSession): Promise<EventDoc> {
    const [created] = await EventModel.create([doc], { session });
    return created.toObject() as EventDoc;
  },

  /** Conditional update: only applies when `where` still matches (optimistic state check). */
  async updateWhere(id: string, where: Record<string, unknown>, set: Partial<EventDoc>, session?: TxSession): Promise<EventDoc | null> {
    return EventModel.findOneAndUpdate({ _id: id, deletedAt: null, ...where }, { $set: set }, { returnDocument: "after", session, runValidators: true }).lean<EventDoc>();
  },

  /**
   * Atomically take one seat. The capacity guard and the increment happen in
   * a single document update, so concurrent registrations cannot oversell.
   */
  async reserveSeat(eventId: string, now: Date, session?: TxSession): Promise<EventDoc | null> {
    return EventModel.findOneAndUpdate(
      {
        _id: eventId,
        deletedAt: null,
        status: "published",
        registrationOpensAt: { $lte: now },
        registrationClosesAt: { $gte: now },
        $expr: { $lt: ["$registeredCount", "$capacity"] },
      },
      { $inc: { registeredCount: 1 } },
      { returnDocument: "after", session },
    ).lean<EventDoc>();
  },

  async releaseSeat(eventId: string, session?: TxSession): Promise<void> {
    await EventModel.updateOne({ _id: eventId, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } }, { session });
  },

  async adjustInterestCount(eventId: string, delta: 1 | -1, session?: TxSession): Promise<void> {
    const filter: Record<string, unknown> = { _id: eventId };
    if (delta < 0) filter.interestCount = { $gt: 0 };
    await EventModel.updateOne(filter, { $inc: { interestCount: delta } }, { session });
  },
};
