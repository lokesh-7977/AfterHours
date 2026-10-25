import "server-only";
import { getEnv } from "./env";

/** The configured public contact address, or null when none is set (contact links are then hidden). */
export function getContactEmail(): string | null {
  try {
    return getEnv().CONTACT_EMAIL ?? null;
  } catch {
    return null; // misconfigured env surfaces elsewhere; the footer should still render
  }
}
