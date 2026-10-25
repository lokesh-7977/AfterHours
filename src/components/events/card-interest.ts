import "server-only";
import { unstable_rethrow } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guards";
import { isAdminRole } from "@/modules/auth/roles";
import { interestedEventIds } from "@/modules/interests/interest.service";
import type { CardInterest } from "./event-card";

/** Resolves the viewer's interest state for a set of cards with one query. */
export async function cardInterestFor(eventIds: string[]): Promise<(eventId: string) => CardInterest> {
  const user = await getSessionUser().catch((err) => {
    unstable_rethrow(err);
    return null;
  });
  if (!user) return () => ({ signedIn: false, interested: false });
  if (isAdminRole(user.role)) return () => null; // interest is a participant feature
  const ids = await interestedEventIds(user.id, eventIds).catch((err) => {
    unstable_rethrow(err);
    return new Set<string>();
  });
  return (eventId) => ({ signedIn: true, interested: ids.has(eventId) });
}
