import { apiRoute, ok, readId, readJson } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { z } from "zod";
import { setEventPoster } from "@/modules/events/event.service";

const body = z.object({ mediaId: z.uuid().nullable() });
export const PUT = apiRoute<{ eventId: string }>(async (req, { params }) => {
  const { mediaId } = await readJson(req, body);
  return ok(await setEventPoster(await getSessionUser(), readId(params.eventId, "Event"), mediaId));
});
