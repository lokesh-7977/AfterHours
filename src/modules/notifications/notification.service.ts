import "server-only";
import { after } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { mapLimit } from "@/lib/concurrency";
import { getEnv } from "@/lib/env";
import { errors, isDuplicateKeyError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { getEmailProvider, renderEmail } from "@/infrastructure/email/email-provider";
import { assertAuthenticated } from "@/modules/auth/policies";
import type { SessionUser } from "@/modules/auth/roles";
import { UserModel } from "@/modules/users/user.model";
import { NotificationModel, type NotificationDoc, type NotificationType } from "./notification.model";

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
  /** Must be deterministic for the business fact, e.g. `payment_approved:<registrationId>`. */
  dedupeKey: string;
  email?: boolean;
}

const MAX_EMAIL_ATTEMPTS = 6;
/** Parallel sends per batch; each send is independently leased, so concurrency is safe. */
const EMAIL_CONCURRENCY = 8;
const LEASE_MS = 5 * 60 * 1000;

function toDoc(input: NotifyInput): Omit<NotificationDoc, "_id" | "readAt" | "createdAt" | "updatedAt"> {
  return {
    userId: input.userId,
    type: input.type,
    title: input.title.slice(0, 200),
    body: input.body.slice(0, 2000),
    link: input.link ?? null,
    dedupeKey: input.dedupeKey,
    email: { status: input.email === false ? "skipped" : "pending", attempts: 0, lastError: null, nextAttemptAt: new Date(), sentAt: null },
  };
}

/** Schedule delivery after the response; outside a request the maintenance job delivers it. */
function scheduleDelivery(ids: string[]): void {
  if (ids.length === 0) return;
  const run = async () => {
    await mapLimit(ids, EMAIL_CONCURRENCY, deliverNotificationEmail);
  };
  try {
    after(run);
  } catch {
    void run().catch((err) => logger.error("notification.delivery_failed", { err }));
  }
}

/**
 * Record an in-app notification and queue its email. Called after the core
 * transaction commits; a failure here never rolls back the business change,
 * and the unique dedupe key makes retries harmless.
 */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    await connectDB();
    const [doc] = await NotificationModel.create([toDoc(input)]);
    if (input.email !== false) scheduleDelivery([doc._id]);
  } catch (err) {
    if (isDuplicateKeyError(err)) return;
    logger.error("notification.create_failed", { type: input.type, err });
  }
}

export async function notifyMany(inputs: NotifyInput[]): Promise<void> {
  if (inputs.length === 0) return;
  await connectDB();
  for (let i = 0; i < inputs.length; i += 500) {
    const batch = inputs.slice(i, i + 500);
    try {
      const docs = await NotificationModel.insertMany(batch.map(toDoc), { ordered: false });
      scheduleDelivery(docs.filter((d) => d.email.status === "pending").map((d) => d._id));
    } catch (err) {
      // ordered:false inserts every non-duplicate; duplicates are expected on retries.
      const writeErrors = (err as { writeErrors?: { code?: number; err?: { code?: number } }[] }).writeErrors ?? [];
      const onlyDuplicates = writeErrors.length > 0 && writeErrors.every((w) => (w.code ?? w.err?.code) === 11000);
      if (!onlyDuplicates && !isDuplicateKeyError(err)) logger.error("notification.bulk_create_failed", { err });
    }
  }
}

/** Claim, send and record one email. Safe to call concurrently: a lease prevents double sends. */
export async function deliverNotificationEmail(id: string): Promise<void> {
  await connectDB();
  const now = new Date();
  const claimed = await NotificationModel.findOneAndUpdate(
    { _id: id, "email.status": { $in: ["pending", "failed"] }, "email.nextAttemptAt": { $lte: now } },
    { $set: { "email.nextAttemptAt": new Date(now.getTime() + LEASE_MS) }, $inc: { "email.attempts": 1 } },
    { returnDocument: "after" },
  ).lean<NotificationDoc>();
  if (!claimed) return;

  try {
    const user = await UserModel.findById(claimed.userId).select({ email: 1 }).lean();
    if (!user?.email) {
      await NotificationModel.updateOne({ _id: id }, { $set: { "email.status": "skipped", "email.nextAttemptAt": null } });
      return;
    }
    const actionUrl = claimed.link ? new URL(claimed.link, getEnv().APP_URL).toString() : undefined;
    await getEmailProvider().send({
      to: user.email,
      subject: claimed.title,
      ...renderEmail({ heading: claimed.title, body: claimed.body, actionUrl, actionLabel: "View details" }),
    });
    await NotificationModel.updateOne({ _id: id }, { $set: { "email.status": "sent", "email.sentAt": new Date(), "email.nextAttemptAt": null, "email.lastError": null } });
  } catch (err) {
    const attempts = claimed.email.attempts;
    const giveUp = attempts >= MAX_EMAIL_ATTEMPTS;
    const backoffMs = Math.min(2 ** attempts, 360) * 60 * 1000;
    await NotificationModel.updateOne(
      { _id: id },
      {
        $set: {
          "email.status": "failed",
          "email.lastError": err instanceof Error ? err.message.slice(0, 300) : "send failed",
          "email.nextAttemptAt": giveUp ? null : new Date(Date.now() + backoffMs),
        },
      },
    );
    logger.warn("notification.email_failed", { id, attempts, giveUp });
  }
}

/** Retry queue processed by the maintenance job. */
export async function processPendingEmails(limit = 200): Promise<number> {
  await connectDB();
  const due = await NotificationModel.find({ "email.status": { $in: ["pending", "failed"] }, "email.nextAttemptAt": { $lte: new Date() } })
    .select({ _id: 1 })
    .sort({ "email.nextAttemptAt": 1 })
    .limit(limit)
    .lean();
  await mapLimit(due.map((n) => n._id), EMAIL_CONCURRENCY, deliverNotificationEmail);
  return due.length;
}

export interface NotificationDTO {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export async function listMyNotifications(actor: SessionUser | null, query: z.infer<typeof paginationSchema>): Promise<Paginated<NotificationDTO> & { unread: number }> {
  assertAuthenticated(actor);
  await connectDB();
  const filter = { userId: actor.id };
  const [docs, total, unread] = await Promise.all([
    NotificationModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<NotificationDoc[]>(),
    NotificationModel.countDocuments(filter),
    NotificationModel.countDocuments({ userId: actor.id, readAt: null }),
  ]);
  return {
    ...buildPage(
      docs.map((d) => ({ id: d._id, type: d.type, title: d.title, body: d.body, link: d.link, readAt: d.readAt?.toISOString() ?? null, createdAt: d.createdAt.toISOString() })),
      total,
      query,
    ),
    unread,
  };
}

export async function markNotificationsRead(actor: SessionUser | null, ids: string[] | "all"): Promise<number> {
  assertAuthenticated(actor);
  await connectDB();
  if (ids !== "all" && ids.length > 100) throw errors.badRequest("Too many ids");
  const filter: Record<string, unknown> = { userId: actor.id, readAt: null };
  if (ids !== "all") filter._id = { $in: ids };
  const res = await NotificationModel.updateMany(filter, { $set: { readAt: new Date() } });
  return res.modifiedCount;
}

export async function unreadNotificationCount(userId: string): Promise<number> {
  await connectDB();
  return NotificationModel.countDocuments({ userId, readAt: null });
}
