import "server-only";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { errors } from "@/lib/errors";
import { buildPage, paginationSchema, toSkip, type Paginated } from "@/lib/pagination";
import { withTransaction } from "@/lib/transactions";
import { escapeRegex, optionalTrimmed, parseInput, optionalBlank } from "@/lib/validation";
import { assertAuthenticated, assertSuperAdmin } from "@/modules/auth/policies";
import { ROLES, toRole, type Role, type SessionUser } from "@/modules/auth/roles";
import { recordAudit } from "@/modules/audit/audit.service";
import { UserModel, type UserDoc } from "./user.model";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  phone: string | null;
}

function toAdminUserDTO(u: UserDoc): UserAdminDTO {
  return {
    id: u._id,
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    role: toRole(u.role),
    emailVerified: Boolean(u.emailVerified),
    createdAt: u.createdAt ? new Date(u.createdAt).toISOString() : null,
  };
}

export interface UserAdminDTO extends UserSummary {
  role: Role;
  emailVerified: boolean;
  createdAt: string | null;
}

export async function getUserSummaries(ids: string[]): Promise<Map<string, UserSummary>> {
  await connectDB();
  const unique = Array.from(new Set(ids)).filter(Boolean);
  if (unique.length === 0) return new Map();
  const users = await UserModel.find({ _id: { $in: unique } }).select({ name: 1, email: 1, phone: 1 }).lean<UserDoc[]>();
  return new Map(users.map((u) => [u._id, { id: u._id, name: u.name, email: u.email, phone: u.phone ?? null }]));
}

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100),
  phone: z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number").nullable(),
  ),
});

/** Profile changes are limited to name/phone; role and email are never writable here. */
export async function updateProfile(actor: SessionUser | null, rawInput: unknown): Promise<UserSummary> {
  assertAuthenticated(actor);
  const input = parseInput(profileSchema, rawInput);
  await connectDB();
  const user = await UserModel.findOneAndUpdate(
    { _id: actor.id },
    { $set: { name: input.name, phone: input.phone, updatedAt: new Date() } },
    { returnDocument: "after" },
  ).lean<UserDoc>();
  if (!user) throw errors.notFound("User");
  return { id: user._id, name: user.name, email: user.email, phone: user.phone ?? null };
}

export const userListQuerySchema = paginationSchema.extend({
  q: optionalTrimmed(100),
  role: optionalBlank(z.enum(ROLES)),
});

export async function listUsers(actor: SessionUser | null, rawQuery: unknown): Promise<Paginated<UserAdminDTO>> {
  assertSuperAdmin(actor);
  const query = parseInput(userListQuerySchema, rawQuery);
  await connectDB();
  const filter: Record<string, unknown> = {};
  if (query.role) filter.role = query.role;
  if (query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: "i" };
    filter.$or = [{ email: rx }, { name: rx }];
  }
  const [docs, total] = await Promise.all([
    UserModel.find(filter).sort({ createdAt: -1 }).skip(toSkip(query)).limit(query.pageSize).lean<UserDoc[]>(),
    UserModel.countDocuments(filter),
  ]);
  return buildPage(
    docs.map(toAdminUserDTO),
    total,
    query,
  );
}

/** Delete every Better Auth session of a user (forces sign-out everywhere). */
export async function revokeAllSessionsForUser(userId: string): Promise<number> {
  await connectDB();
  const res = await mongoose.connection.collection("session").deleteMany({ userId });
  return res.deletedCount;
}

export const setRoleSchema = z.object({ role: z.enum(ROLES) });

/**
 * High-risk action reserved for super admins. Sessions of the target are
 * revoked so the new privilege level applies immediately.
 */
export async function setUserRole(actor: SessionUser | null, targetUserId: string, rawInput: unknown): Promise<UserAdminDTO> {
  assertSuperAdmin(actor);
  const { role } = parseInput(setRoleSchema, rawInput);
  if (targetUserId === actor.id) throw errors.conflict("You cannot change your own role", "SELF_ROLE_CHANGE");
  await connectDB();
  const updated = await withTransaction(async (session) => {
    const before = await UserModel.findById(targetUserId).session(session ?? null).lean<UserDoc>();
    if (!before) throw errors.notFound("User");
    if (before.role === "super_admin" && role !== "super_admin") {
      const superAdmins = await UserModel.countDocuments({ role: "super_admin" }).session(session ?? null);
      if (superAdmins <= 1) throw errors.conflict("At least one super admin must remain", "LAST_SUPER_ADMIN");
    }
    const after = await UserModel.findOneAndUpdate({ _id: targetUserId }, { $set: { role, updatedAt: new Date() } }, { returnDocument: "after", session }).lean<UserDoc>();
    await recordAudit({ actor, action: "user.role_change", entityType: "user", entityId: targetUserId, metadata: { from: before.role, to: role } }, session);
    return after!;
  });
  await revokeAllSessionsForUser(targetUserId);
  return toAdminUserDTO(updated);
}

export async function adminRevokeSessions(actor: SessionUser | null, targetUserId: string): Promise<number> {
  assertSuperAdmin(actor);
  const count = await revokeAllSessionsForUser(targetUserId);
  await recordAudit({ actor, action: "user.sessions_revoke", entityType: "user", entityId: targetUserId, metadata: { count } });
  return count;
}

