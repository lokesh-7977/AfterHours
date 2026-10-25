import "server-only";
import mongoose, { Schema, type Model } from "mongoose";
import { connectDB } from "./db";
import { errors, isDuplicateKeyError } from "./errors";

interface RateLimitBucket {
  _id: string;
  count: number;
  expiresAt: Date;
}

const bucketSchema = new Schema<RateLimitBucket>(
  {
    _id: { type: String, required: true },
    count: { type: Number, required: true, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "rate_limit_buckets", versionKey: false },
);
bucketSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitBucketModel: Model<RateLimitBucket> =
  (mongoose.models.RateLimitBucket as Model<RateLimitBucket>) ??
  mongoose.model<RateLimitBucket>("RateLimitBucket", bucketSchema);

export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
}

/** Shared limits so policies are tuned in one place. */
export const RATE_LIMITS = {
  attendanceCodeFailures: { limit: 5, windowSeconds: 15 * 60 },
  attendanceCodeAttempts: { limit: 20, windowSeconds: 60 * 60 },
  comments: { limit: 10, windowSeconds: 60 },
  mediaOps: { limit: 120, windowSeconds: 10 * 60 },
  mediaDownloads: { limit: 300, windowSeconds: 10 * 60 },
  registrations: { limit: 20, windowSeconds: 10 * 60 },
  qrScans: { limit: 120, windowSeconds: 60 },
  reports: { limit: 20, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;

function bucketId(key: string, rule: RateLimitRule, now: number) {
  const windowStart = Math.floor(now / 1000 / rule.windowSeconds) * rule.windowSeconds;
  return { id: `${key}:${rule.windowSeconds}:${windowStart}`, resetAt: new Date((windowStart + rule.windowSeconds) * 1000) };
}

/**
 * Fixed-window counter stored in MongoDB so limits hold across server
 * instances (no in-process state). Expired buckets are removed by a TTL index.
 */
export async function consumeRateLimit(key: string, rule: RateLimitRule): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  await connectDB();
  const { id, resetAt } = bucketId(key, rule, Date.now());
  const update = { $inc: { count: 1 }, $setOnInsert: { expiresAt: resetAt } };
  let doc: RateLimitBucket | null;
  try {
    doc = await RateLimitBucketModel.findOneAndUpdate({ _id: id }, update, { upsert: true, returnDocument: "after" }).lean();
  } catch (err) {
    // Two concurrent upserts can race on the unique _id; the retry increments the winner's doc.
    if (!isDuplicateKeyError(err)) throw err;
    doc = await RateLimitBucketModel.findOneAndUpdate({ _id: id }, update, { upsert: true, returnDocument: "after" }).lean();
  }
  const count = doc?.count ?? 1;
  return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), resetAt };
}

export async function enforceRateLimit(key: string, rule: RateLimitRule): Promise<void> {
  const result = await consumeRateLimit(key, rule);
  if (!result.allowed) throw errors.rateLimited();
}

/** Check without consuming (used to count only failed attempts). */
export async function isRateLimited(key: string, rule: RateLimitRule): Promise<boolean> {
  await connectDB();
  const { id } = bucketId(key, rule, Date.now());
  const doc = await RateLimitBucketModel.findById(id).lean();
  return (doc?.count ?? 0) >= rule.limit;
}
