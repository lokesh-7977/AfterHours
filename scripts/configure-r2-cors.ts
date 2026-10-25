/**
 * Apply the bucket CORS policy needed for direct browser uploads (`pnpm r2:cors`).
 * Only the app origins may PUT; ETag is exposed for multipart uploads.
 * CORS is not authorization: every upload URL is still issued per request
 * after server-side checks, and the bucket must stay private.
 */
import { PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { getR2Bucket, getR2Client } from "@/infrastructure/storage/r2-client";
import { getTrustedOrigins } from "@/lib/env";

async function main() {
  const origins = getTrustedOrigins();
  await getR2Client().send(
    new PutBucketCorsCommand({
      Bucket: getR2Bucket(),
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["PUT", "GET", "HEAD"],
            AllowedHeaders: ["content-type", "content-length"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  console.log(`CORS applied for: ${origins.join(", ")}`);
}

main().catch((err) => {
  console.error("CORS configuration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
