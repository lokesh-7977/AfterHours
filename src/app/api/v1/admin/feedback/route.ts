import { apiRoute, ok, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listFeedback } from "@/modules/feedback/feedback.service";

export const GET = apiRoute(async (req) => ok(await listFeedback(await getSessionUser(), queryObject(req))));
