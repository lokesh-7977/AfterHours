import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser } from "./auth-guards";
import { isAdminRole, type SessionUser } from "@/modules/auth/roles";

/**
 * Page-level guards. These improve UX (redirects); the authoritative checks
 * still run in every service the page calls.
 */
export async function requireParticipantPage(next: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (isAdminRole(user.role)) redirect("/admin/dashboard");
  return user;
}

export async function requireAdminPage(opts: { superAdmin?: boolean } = {}): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  if (!isAdminRole(user.role)) redirect("/admin/login?error=forbidden");
  if (opts.superAdmin && user.role !== "super_admin") redirect("/admin/dashboard?error=super_admin_only");
  return user;
}
