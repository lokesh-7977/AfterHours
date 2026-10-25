import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { completeUpload } from "@/modules/media/media.service";

/** Step 3: verify the stored object and process it (idempotent). */
export const POST = apiRoute<{ mediaId: string }>(async (req, { params }) => ok(await completeUpload(await getSessionUser(), readId(params.mediaId, "Upload"), await readBody(req))));
