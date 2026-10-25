import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { reportMedia } from "@/modules/media/media.service";

/** Privacy / consent removal request: hides the item pending admin review. */
export const POST = apiRoute<{ mediaId: string }>(async (req, { params }) => {
  await reportMedia(await getSessionUser(), readId(params.mediaId, "Media"), await readBody(req));
  return ok({ reported: true });
});
