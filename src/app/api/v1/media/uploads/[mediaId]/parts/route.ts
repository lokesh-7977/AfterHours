import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { signUploadParts } from "@/modules/media/media.service";

export const POST = apiRoute<{ mediaId: string }>(async (req, { params }) => ok(await signUploadParts(await getSessionUser(), readId(params.mediaId, "Upload"), await readBody(req))));
