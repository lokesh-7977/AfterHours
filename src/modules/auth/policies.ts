import { errors } from "@/lib/errors";
import { isAdminRole, isSuperAdminRole, type SessionUser } from "./roles";

/**
 * Pure authorization assertions. Services call these with the actor resolved
 * from the verified session, so every business operation re-checks
 * permissions regardless of which entry point (route, action, script) called it.
 */
export function assertAuthenticated(actor: SessionUser | null | undefined): asserts actor is SessionUser {
  if (!actor) throw errors.unauthenticated();
}

export function assertAdmin(actor: SessionUser | null | undefined): asserts actor is SessionUser {
  assertAuthenticated(actor);
  if (!isAdminRole(actor.role)) throw errors.forbidden("Administrator access required");
}

export function assertSuperAdmin(actor: SessionUser | null | undefined): asserts actor is SessionUser {
  assertAuthenticated(actor);
  if (!isSuperAdminRole(actor.role)) throw errors.forbidden("Super administrator access required");
}

export function assertParticipant(actor: SessionUser | null | undefined): asserts actor is SessionUser {
  assertAuthenticated(actor);
  if (actor.role !== "participant") {
    throw errors.forbidden("This action is available to participant accounts only");
  }
}

/** Owner of a private resource, or any administrator. */
export function assertOwnerOrAdmin(actor: SessionUser | null | undefined, ownerId: string): asserts actor is SessionUser {
  assertAuthenticated(actor);
  if (actor.id !== ownerId && !isAdminRole(actor.role)) throw errors.notFound();
}
