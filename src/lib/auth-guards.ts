import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { connection } from "next/server";
import { getAuth } from "./auth";
import { toRole, type SessionUser } from "@/modules/auth/roles";

/**
 * Resolve the current user from the Better Auth session cookie. Better Auth
 * validates the session against the database on every call (no cookie cache
 * is configured), so the role reflects current database state and revoked
 * sessions stop working immediately.
 *
 * Entry points (routes, actions, pages) pass this user to services, which
 * authorize with the `assert*` policies in modules/auth/policies.ts.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Session validity depends on the current time (expiry), so this read is always per request.
  await connection();
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: unknown; phone?: string | null };
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: toRole(u.role),
    emailVerified: u.emailVerified,
    phone: u.phone ?? null,
  };
});
