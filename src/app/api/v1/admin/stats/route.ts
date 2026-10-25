import { apiRoute, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { getDashboardStats } from "@/modules/admin/stats.service";

export const GET = apiRoute(async () => ok(await getDashboardStats(await getSessionUser())));
