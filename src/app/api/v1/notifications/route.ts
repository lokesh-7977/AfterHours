import { apiRoute, ok, readQuery } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { paginationSchema } from "@/lib/pagination";
import { listMyNotifications } from "@/modules/notifications/notification.service";

export const GET = apiRoute(async (req) => ok(await listMyNotifications(await getSessionUser(), readQuery(req, paginationSchema))));
