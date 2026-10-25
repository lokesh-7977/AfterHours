import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { abortUpload } from "@/modules/media/media.service";

export const DELETE = apiRoute<{ mediaId: string }>(async (_req, { params }) => {
  await abortUpload(await getSessionUser(), readId(params.mediaId, "Upload"));
  return ok({ aborted: true });
});
