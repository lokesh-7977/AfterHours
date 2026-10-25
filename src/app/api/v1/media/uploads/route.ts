import { apiRoute, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { requestUpload } from "@/modules/media/media.service";

/** Step 1: create a pending media record and return a presigned R2 upload. */
export const POST = apiRoute(async (req) => ok(await requestUpload(await getSessionUser(), await readBody(req)), { status: 201 }));
