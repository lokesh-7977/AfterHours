import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { getMyRegistrationForEvent, registerForEvent } from "@/modules/registrations/registration.service";

/** The caller's registration for this event (null if none). */
export const GET = apiRoute<{ eventId: string }>(async (_req, { params }) => ok(await getMyRegistrationForEvent(await getSessionUser(), readId(params.eventId, "Event"))));
export const POST = apiRoute<{ eventId: string }>(async (_req, { params }) => ok(await registerForEvent(await getSessionUser(), readId(params.eventId, "Event")), { status: 201 }));
