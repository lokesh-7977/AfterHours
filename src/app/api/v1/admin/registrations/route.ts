import { apiRoute, ok, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listRegistrations } from "@/modules/registrations/registration.service";

export const GET = apiRoute(async (req) => ok(await listRegistrations(await getSessionUser(), queryObject(req))));
