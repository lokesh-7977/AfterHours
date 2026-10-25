import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { getEnv, isR2Configured } from "@/lib/env";
import { errors } from "@/lib/errors";

let client: S3Client | undefined;

/** S3-compatible client for Cloudflare R2. Credentials never leave the server. */
export function getR2Client(): S3Client {
  if (client) return client;
  const env = getEnv();
  if (!isR2Configured(env)) throw errors.unavailable("Media storage is not configured");
  client = new S3Client({
    region: "auto",
    endpoint: env.R2_ENDPOINT ?? `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID!, secretAccessKey: env.R2_SECRET_ACCESS_KEY! },
    // R2 does not support the SDK's default flexible checksums on presigned uploads.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });
  return client;
}

export function getR2Bucket(): string {
  const bucket = getEnv().R2_BUCKET_NAME;
  if (!bucket) throw errors.unavailable("Media storage is not configured");
  return bucket;
}
