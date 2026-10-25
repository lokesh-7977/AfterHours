import { apiRoute, ok, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listCommentsForModeration } from "@/modules/comments/comment.service";

export const GET = apiRoute(async (req) => ok(await listCommentsForModeration(await getSessionUser(), queryObject(req))));
