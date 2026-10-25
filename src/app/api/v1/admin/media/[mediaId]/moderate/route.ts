import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { moderateMedia } from "@/modules/media/media.service";

export const POST = apiRoute<{ mediaId: string }>(async (req, { params }) => ok(await moderateMedia(await getSessionUser(), readId(params.mediaId, "Media"), await readBody(req))));
