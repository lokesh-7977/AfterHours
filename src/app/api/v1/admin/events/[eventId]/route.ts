import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { deleteEvent, getAdminEvent, updateEvent } from "@/modules/events/event.service";

export const GET = apiRoute<{ eventId: string }>(async (_req, { params }) => ok(await getAdminEvent(await getSessionUser(), readId(params.eventId, "Event"))));
export const PUT = apiRoute<{ eventId: string }>(async (req, { params }) => ok(await updateEvent(await getSessionUser(), readId(params.eventId, "Event"), await readBody(req))));
export const DELETE = apiRoute<{ eventId: string }>(async (_req, { params }) => {
  await deleteEvent(await getSessionUser(), readId(params.eventId, "Event"));
  return ok({ deleted: true });
});
