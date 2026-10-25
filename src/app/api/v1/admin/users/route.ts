import { apiRoute, ok, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listUsers } from "@/modules/users/user.service";

/** Super admin only. */
export const GET = apiRoute(async (req) => ok(await listUsers(await getSessionUser(), queryObject(req))));
