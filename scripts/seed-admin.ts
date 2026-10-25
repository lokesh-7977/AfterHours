/**
 * Provision (or promote) the first super admin.
 *
 *   pnpm seed:admin                      # reads ADMIN_SEED_EMAIL / ADMIN_SEED_PASSWORD / ADMIN_SEED_NAME
 *   pnpm seed:admin                      # prompts interactively when they are not set
 *
 * The password is never printed or logged. Remove ADMIN_SEED_PASSWORD from the
 * environment after the first run.
 */
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { getAuth } from "@/lib/auth";
import { connectDB, disconnectDB } from "@/lib/db";
import { UserModel } from "@/modules/users/user.model";
import { recordAudit } from "@/modules/audit/audit.service";

async function prompt(question: string, hidden = false): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  const answerPromise = rl.question(question);
  muted = hidden;
  const answer = await answerPromise;
  rl.close();
  if (hidden) process.stdout.write("\n");
  return answer.trim();
}

async function main() {
  let email = process.env.ADMIN_SEED_EMAIL?.trim().toLowerCase();
  let password = process.env.ADMIN_SEED_PASSWORD;
  let name = process.env.ADMIN_SEED_NAME?.trim() || "Super Admin";
  if (!email) email = (await prompt("Super admin email: ")).toLowerCase();
  if (!password) {
    if (!process.stdin.isTTY) throw new Error("ADMIN_SEED_PASSWORD is not set and no terminal is available for a prompt");
    password = await prompt("Password (min 10 chars, hidden): ", true);
    name = (await prompt(`Display name [${name}]: `)) || name;
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Invalid email");
  if (password.length < 10) throw new Error("Use a password of at least 10 characters (the app minimum)");

  await connectDB();
  const ctx = await getAuth().$context;
  const existing = await UserModel.findOne({ email }).lean();

  let userId: string;
  if (existing) {
    userId = existing._id;
    console.log("Account exists; promoting to super_admin (password unchanged).");
  } else {
    const user = await ctx.internalAdapter.createUser({ email, name, emailVerified: true }, { method: "admin" });
    userId = user.id;
    await ctx.internalAdapter.linkAccount({
      userId,
      providerId: "credential",
      accountId: userId,
      password: await ctx.password.hash(password),
    });
    console.log("Created super admin account.");
  }
  await UserModel.updateOne({ _id: userId }, { $set: { role: "super_admin", emailVerified: true, updatedAt: new Date() } });
  await recordAudit({ actor: null, action: "user.seed_super_admin", entityType: "user", entityId: userId, metadata: { email } });
  console.log(`Super admin ready: ${email}. Sign in at /admin/login`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
