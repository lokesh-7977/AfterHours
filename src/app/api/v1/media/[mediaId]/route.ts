import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { deleteMedia } from "@/modules/media/media.service";

export const DELETE = apiRoute<{ mediaId: string }>(async (_req, { params }) => {
  await deleteMedia(await getSessionUser(), readId(params.mediaId, "Media"));
  return ok({ deleted: true });
});
