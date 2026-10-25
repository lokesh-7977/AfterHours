import "server-only";
import { connectDB } from "@/lib/db";
import { logger } from "@/lib/logger";
import { EventModel, type EventDoc } from "@/modules/events/event.model";
import { completeEndedEvents } from "@/modules/events/event.service";
import { runMediaCleanup, type CleanupReport } from "@/modules/media/media-cleanup.service";
import { notifyMany, processPendingEmails } from "@/modules/notifications/notification.service";
import { reconcileMissingPasses } from "@/modules/passes/pass.service";
import { RegistrationModel } from "@/modules/registrations/registration.model";

export interface MaintenanceReport {
  passesReconciled: number;
  eventsCompleted: number;
  remindersQueued: number;
  emailsProcessed: number;
  media: CleanupReport;
  durationMs: number;
}

/** Reminders for events starting within the next 24h; dedupe keys make it safe to run hourly. */
async function queueEventReminders(now: Date): Promise<number> {
  const soon = await EventModel.find({ status: "published", deletedAt: null, startsAt: { $gte: now, $lte: new Date(now.getTime() + 24 * 3600_000) } })
    .select({ title: 1, startsAt: 1, venueName: 1, city: 1 })
    .lean<Pick<EventDoc, "_id" | "title" | "startsAt" | "venueName" | "city">[]>();
  if (soon.length === 0) return 0;
  const byId = new Map(soon.map((e) => [e._id, e]));
  const regs = await RegistrationModel.find({ eventId: { $in: soon.map((e) => e._id) }, status: "registered", paymentStatus: "approved" }).select({ userId: 1, eventId: 1 }).lean();
  await notifyMany(
    regs.map((r) => {
      const event = byId.get(r.eventId)!;
      return {
        userId: r.userId,
        type: "event_reminder" as const,
        title: `Tomorrow: ${event.title}`,
        body: `${event.title} starts ${event.startsAt.toUTCString()} at ${event.venueName}, ${event.city}. Keep your QR pass ready.`,
        link: "/my-passes",
        dedupeKey: `event_reminder:${event._id}:${r.userId}`,
      };
    }),
  );
  return regs.length;
}

/**
 * Scheduled job (cron → POST /api/v1/admin/maintenance or `pnpm maintenance`).
 * Every step is idempotent and independent; one failing step does not stop the rest.
 */
export async function runMaintenance(now = new Date()): Promise<MaintenanceReport> {
  const started = Date.now();
  await connectDB();
  const step = async <T>(name: string, fn: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await fn();
    } catch (err) {
      logger.error("maintenance.step_failed", { step: name, err });
      return fallback;
    }
  };
  // Independent steps run concurrently; email retries run after reminders so new reminders go out in the same run.
  const [passesReconciled, eventsCompleted, [remindersQueued, emailsProcessed], media] = await Promise.all([
    step("passes", () => reconcileMissingPasses(), 0),
    step("events", () => completeEndedEvents(now), 0),
    (async () => [await step("reminders", () => queueEventReminders(now), 0), await step("emails", () => processPendingEmails(), 0)] as const)(),
    step("media", () => runMediaCleanup(now), { abandoned: 0, stuck: 0, purged: 0, orphansDeleted: 0, multipartAborted: 0, errors: 1 }),
  ]);
  const report = { passesReconciled, eventsCompleted, remindersQueued, emailsProcessed, media, durationMs: Date.now() - started };
  logger.info("maintenance.completed", report as unknown as Record<string, unknown>);
  return report;
}
