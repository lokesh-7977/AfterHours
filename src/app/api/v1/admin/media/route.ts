import { apiRoute, ok, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listModerationQueue } from "@/modules/media/media.service";

export const GET = apiRoute(async (req) => ok(await listModerationQueue(await getSessionUser(), queryObject(req))));
