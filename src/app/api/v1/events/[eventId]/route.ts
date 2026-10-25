import { apiRoute, ok } from "@/lib/http";
import { errors } from "@/lib/errors";
import { isUuidV7 } from "@/lib/ids";
import { getPublicEventById, getPublicEventBySlug } from "@/modules/events/event.service";
import { toEventDetail } from "@/modules/events/event.dto";

/** Accepts an event id or slug. */
export const GET = apiRoute<{ eventId: string }>(async (_req, { params }) => {
  const key = params.eventId;
  const event = isUuidV7(key) ? await getPublicEventById(key).then((e) => (e ? toEventDetail(e) : null)) : await getPublicEventBySlug(key);
  if (!event) throw errors.notFound("Event");
  return ok(event);
});
