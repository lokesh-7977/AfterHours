import "server-only";
import { connectDB } from "@/lib/db";
import { mapLimit } from "@/lib/concurrency";
import { isR2Configured } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getStorage } from "@/infrastructure/storage/r2-storage.service";
import { EventMediaModel, type EventMediaDoc } from "./media.model";

const HOUR = 60 * 60 * 1000;
const ABANDONED_AFTER_MS = 24 * HOUR;
const STUCK_PROCESSING_AFTER_MS = 1 * HOUR;
const REJECTED_RETENTION_MS = 7 * 24 * HOUR;
const ORPHAN_MIN_AGE_MS = 24 * HOUR;
const CLEANUP_CONCURRENCY = 8;

export interface CleanupReport {
  abandoned: number;
  stuck: number;
  purged: number;
  orphansDeleted: number;
  multipartAborted: number;
  errors: number;
}

async function purge(media: EventMediaDoc, report: CleanupReport) {
  const storage = getStorage();
  try {
    if (media.multipartUploadId) await storage.abortMultipartUpload(media.storageKey, media.multipartUploadId);
    await storage.deleteObject(media.storageKey);
    if (media.thumbnailKey) await storage.deleteObject(media.thumbnailKey);
    await EventMediaModel.updateOne({ _id: media._id }, { $set: { purgedAt: new Date(), multipartUploadId: null } });
    report.purged++;
  } catch (err) {
    report.errors++;
    logger.warn("media.cleanup.purge_failed", { mediaId: media._id, err });
  }
}

/**
 * Idempotent media maintenance:
 *  1. abandon uploads never completed within 24h (incl. multipart abort)
 *  2. fail items stuck in "processing" (crashed workers)
 *  3. purge R2 objects for failed, deleted, and long-rejected media
 *  4. reconcile orphaned R2 objects and dangling multipart uploads
 */
export async function runMediaCleanup(now = new Date(), limit = 500): Promise<CleanupReport> {
  const report: CleanupReport = { abandoned: 0, stuck: 0, purged: 0, orphansDeleted: 0, multipartAborted: 0, errors: 0 };
  if (!isR2Configured()) return report;
  await connectDB();

  const abandoned = await EventMediaModel.updateMany(
    { processingStatus: "pending", createdAt: { $lt: new Date(now.getTime() - ABANDONED_AFTER_MS) }, deletedAt: null },
    { $set: { processingStatus: "failed", failureReason: "Upload abandoned" } },
  );
  report.abandoned = abandoned.modifiedCount;

  const stuck = await EventMediaModel.updateMany(
    { processingStatus: "processing", uploadCompletedAt: { $lt: new Date(now.getTime() - STUCK_PROCESSING_AFTER_MS) } },
    { $set: { processingStatus: "failed", failureReason: "Processing timed out" } },
  );
  report.stuck = stuck.modifiedCount;

  const toPurge = await EventMediaModel.find({
    purgedAt: null,
    $or: [
      { processingStatus: "failed" },
      { deletedAt: { $ne: null } },
      { moderationStatus: "rejected", moderatedAt: { $lt: new Date(now.getTime() - REJECTED_RETENTION_MS) } },
    ],
  })
    .limit(limit)
    .lean<EventMediaDoc[]>();
  await mapLimit(toPurge, CLEANUP_CONCURRENCY, (m) => purge(m, report));

  await reconcileOrphans(now, report, limit);
  return report;
}

async function reconcileOrphans(now: Date, report: CleanupReport, limit: number) {
  const storage = getStorage();
  const cutoff = now.getTime() - ORPHAN_MIN_AGE_MS;
  try {
    let token: string | undefined;
    let scanned = 0;
    do {
      const page = await storage.listObjects("events/", token);
      const old = page.objects.filter((o) => o.lastModified.getTime() < cutoff);
      if (old.length) {
        const keys = old.map((o) => o.key);
        const known = await EventMediaModel.find({ $or: [{ storageKey: { $in: keys } }, { thumbnailKey: { $in: keys } }], purgedAt: null }).select({ storageKey: 1, thumbnailKey: 1 }).lean();
        const knownKeys = new Set(known.flatMap((k) => [k.storageKey, k.thumbnailKey]).filter(Boolean) as string[]);
        const orphans = keys.filter((key) => !knownKeys.has(key)).slice(0, Math.max(0, limit - report.orphansDeleted));
        await mapLimit(orphans, CLEANUP_CONCURRENCY, (key) => storage.deleteObject(key));
        report.orphansDeleted += orphans.length;
      }
      scanned += page.objects.length;
      token = page.nextToken ?? undefined;
    } while (token && scanned < 20_000);

    const stale = (await storage.listMultipartUploads("events/")).filter((u) => u.initiated.getTime() < cutoff);
    const active = new Set(
      (await EventMediaModel.find({ multipartUploadId: { $in: stale.map((u) => u.uploadId) }, processingStatus: "pending" }).select({ multipartUploadId: 1 }).lean()).map((m) => m.multipartUploadId),
    );
    const abandoned = stale.filter((u) => !active.has(u.uploadId));
    await mapLimit(abandoned, CLEANUP_CONCURRENCY, (u) => storage.abortMultipartUpload(u.key, u.uploadId));
    report.multipartAborted += abandoned.length;
  } catch (err) {
    report.errors++;
    logger.error("media.cleanup.reconcile_failed", { err });
  }
}
