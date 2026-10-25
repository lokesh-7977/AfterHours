/** Client-safe role definitions and pure role checks. */
export const ROLES = ["participant", "admin", "super_admin"] as const;
export type Role = (typeof ROLES)[number];

export function toRole(value: unknown): Role {
  return ROLES.includes(value as Role) ? (value as Role) : "participant";
}

export function isAdminRole(role: Role): boolean {
  return role === "admin" || role === "super_admin";
}

export function isSuperAdminRole(role: Role): boolean {
  return role === "super_admin";
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  emailVerified: boolean;
  phone: string | null;
}
