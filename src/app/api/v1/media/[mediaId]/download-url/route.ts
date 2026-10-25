import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { createDownloadUrl } from "@/modules/media/media.service";

export const POST = apiRoute<{ mediaId: string }>(async (_req, { params }) => ok(await createDownloadUrl(await getSessionUser(), readId(params.mediaId, "Media"))));
