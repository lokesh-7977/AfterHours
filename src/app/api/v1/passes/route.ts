import { apiRoute, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { listMyPasses } from "@/modules/passes/pass.service";

export const GET = apiRoute(async () => ok(await listMyPasses(await getSessionUser())));
