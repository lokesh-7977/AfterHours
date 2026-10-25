import "server-only";
import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import { getAuthMongoClient } from "./db";
import { getEnv, getTrustedOrigins } from "./env";
import { newId } from "./ids";
import { logger } from "./logger";
import { getEmailProvider, renderEmail } from "@/infrastructure/email/email-provider";

export const APP_NAME = "AfterHours";

async function sendAuthEmail(to: string, subject: string, heading: string, body: string, url: string, label: string) {
  try {
    await getEmailProvider().send({ to, subject, ...renderEmail({ heading, body, actionUrl: url, actionLabel: label }) });
  } catch (err) {
    // Never log the URL: it contains a single-use token.
    logger.error("auth.email_send_failed", { subject, err });
    throw err;
  }
}

function createAuth() {
  const env = getEnv();
  const client = getAuthMongoClient();
  const isProd = env.NODE_ENV === "production";

  return betterAuth({
    appName: APP_NAME,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: mongodbAdapter(client.db(), { client }),
    trustedOrigins: getTrustedOrigins(env),
    advanced: {
      // String UUID v7 ids; the MongoDB adapter stores custom ids verbatim (verified in its source).
      database: { generateId: () => newId() },
      useSecureCookies: isProd,
      cookiePrefix: "afterhours",
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-real-ip", "x-forwarded-for"] },
    },
    user: {
      additionalFields: {
        // input:false => Better Auth refuses this field on sign-up and update-user.
        // Roles change only through the super-admin service or the seed script.
        role: { type: "string", required: false, defaultValue: "participant", input: false },
        phone: { type: "string", required: false, input: true },
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      requireEmailVerification: env.REQUIRE_EMAIL_VERIFICATION,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 60 * 30,
      sendResetPassword: async ({ user, url }) => {
        await sendAuthEmail(user.email, `Reset your ${APP_NAME} password`, "Password reset", "Use the link below to choose a new password. It expires in 30 minutes. If you did not request this, ignore this email.", url, "Reset password");
      },
    },
    emailVerification: {
      sendOnSignUp: env.REQUIRE_EMAIL_VERIFICATION,
      sendOnSignIn: env.REQUIRE_EMAIL_VERIFICATION,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user, url }) => {
        await sendAuthEmail(user.email, `Verify your ${APP_NAME} email`, "Confirm your email", "Confirm your email address to finish creating your account.", url, "Verify email");
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      freshAge: 60 * 15,
    },
    rateLimit: {
      enabled: env.NODE_ENV !== "test",
      storage: "database",
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/sign-up/email": { window: 60 * 60, max: 20 },
        "/request-password-reset": { window: 60 * 60, max: 5 },
        "/send-verification-email": { window: 60 * 60, max: 5 },
        "/reset-password": { window: 60 * 10, max: 10 },
        "/change-password": { window: 60 * 10, max: 5 },
      },
    },
    plugins: [nextCookies()],
  });
}

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | undefined;

/** Lazily constructed so configuration is validated at first use, not at import. */
export function getAuth(): Auth {
  return (instance ??= createAuth());
}

/** Test hook. */
export function resetAuthForTests(): void {
  instance = undefined;
}
