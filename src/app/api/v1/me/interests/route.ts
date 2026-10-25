import { apiRoute, ok, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listMyInterests } from "@/modules/interests/interest.service";

export const GET = apiRoute(async (req) => ok(await listMyInterests(await getSessionUser(), queryObject(req))));
