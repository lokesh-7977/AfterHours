import { apiRoute, ok, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listMyRegistrations } from "@/modules/registrations/registration.service";

export const GET = apiRoute(async (req) => ok(await listMyRegistrations(await getSessionUser(), queryObject(req))));
