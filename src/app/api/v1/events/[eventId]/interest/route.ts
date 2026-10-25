import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { removeInterest, showInterest } from "@/modules/interests/interest.service";

export const POST = apiRoute<{ eventId: string }>(async (_req, { params }) => ok(await showInterest(await getSessionUser(), readId(params.eventId, "Event"))));
export const DELETE = apiRoute<{ eventId: string }>(async (_req, { params }) => ok(await removeInterest(await getSessionUser(), readId(params.eventId, "Event"))));
