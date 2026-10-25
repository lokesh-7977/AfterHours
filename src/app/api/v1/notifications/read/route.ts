import { apiRoute, ok, readJson } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { z } from "zod";
import { markNotificationsRead } from "@/modules/notifications/notification.service";

const body = z.object({ ids: z.union([z.literal("all"), z.array(z.uuid()).max(100)]) });
export const POST = apiRoute(async (req) => {
  const { ids } = await readJson(req, body);
  return ok({ updated: await markNotificationsRead(await getSessionUser(), ids) });
});
