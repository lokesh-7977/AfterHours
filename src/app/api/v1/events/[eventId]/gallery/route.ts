import { apiRoute, ok, readId, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listGallery } from "@/modules/media/media.service";

export const GET = apiRoute<{ eventId: string }>(async (req, { params }) => ok(await listGallery(await getSessionUser(), readId(params.eventId, "Event"), queryObject(req))));
