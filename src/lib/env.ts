import "server-only";
import { z } from "zod";

/** Treat empty strings from .env files as "not set". */
const blankToUndefined = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const optionalString = z.preprocess(blankToUndefined, z.string().optional());
const optionalUrl = z.preprocess(blankToUndefined, z.url().optional());
const boolFlag = (fallback: boolean) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? v.trim().toLowerCase() : undefined),
    z
      .enum(["true", "false", "1", "0"])
      .optional()
      .transform((v) => (v === undefined ? fallback : v === "true" || v === "1")),
  );
const intWithDefault = (fallback: number) =>
  z.preprocess(blankToUndefined, z.coerce.number().int().positive().default(fallback));

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  /** auto = use transactions when the deployment supports them; required = fail if not; disabled = never. */
  MONGODB_TRANSACTIONS: z.enum(["auto", "required", "disabled"]).default("auto"),

  BETTER_AUTH_SECRET: z.string().min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.url(),
  APP_URL: z.url(),
  /** Extra comma-separated origins allowed to call mutating endpoints (e.g. a preview domain). */
  TRUSTED_ORIGINS: optionalString,
  REQUIRE_EMAIL_VERIFICATION: boolFlag(true),

  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_ENDPOINT: optionalUrl,

  ADMIN_SEED_EMAIL: optionalString,
  ADMIN_SEED_PASSWORD: optionalString,
  ADMIN_SEED_NAME: optionalString,

  EMAIL_PROVIDER: z.enum(["console", "resend"]).default("console"),
  EMAIL_FROM: z.string().default("Events <no-reply@example.com>"),
  EMAIL_PROVIDER_API_KEY: optionalString,

  /** Public contact address shown in the footer and FAQ; omitted from the site when unset. */
  CONTACT_EMAIL: z.preprocess(blankToUndefined, z.email().optional()),

  /** Bearer secret for the scheduled maintenance endpoint. */
  CRON_SECRET: optionalString,

  MEDIA_MAX_IMAGE_BYTES: intWithDefault(15 * 1024 * 1024),
  MEDIA_MAX_VIDEO_BYTES: intWithDefault(500 * 1024 * 1024),
  MEDIA_MAX_VIDEO_DURATION_SECONDS: intWithDefault(600),
  MEDIA_DEFAULT_MAX_UPLOADS_PER_USER: intWithDefault(50),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

/**
 * Validated server configuration. Parsed lazily on first use so importing a
 * module never crashes; an invalid configuration fails loudly the first time
 * the server actually needs it.
 */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (parsed.success) {
    cached = parsed.data;
    return cached;
  }
  if (isBuildPhase()) {
    // `next build` may evaluate server modules without runtime secrets.
    // These placeholders never serve requests.
    cached = envSchema.parse({
      ...process.env,
      MONGODB_URI: process.env.MONGODB_URI || "mongodb://build-placeholder:27017/build",
      BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET || "build-placeholder-secret-build-placeholder",
      BETTER_AUTH_URL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
      APP_URL: process.env.APP_URL || "http://localhost:3000",
    });
    return cached;
  }
  const fields = Object.keys(z.flattenError(parsed.error).fieldErrors).join(", ");
  throw new Error(`Invalid environment configuration: ${fields}`);
}

export function isR2Configured(env: Env = getEnv()): boolean {
  return Boolean(
    env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME && (env.R2_ENDPOINT || env.R2_ACCOUNT_ID),
  );
}

export function getTrustedOrigins(env: Env = getEnv()): string[] {
  const extra = (env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  return Array.from(new Set([new URL(env.APP_URL).origin, new URL(env.BETTER_AUTH_URL).origin, ...extra]));
}

/** Test hook: forget the cached configuration. */
export function resetEnvCache(): void {
  cached = undefined;
}
