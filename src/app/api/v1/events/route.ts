import { apiRoute, ok, queryObject } from "@/lib/http";
import { listPublicEvents } from "@/modules/events/event.service";

export const GET = apiRoute(async (req) => ok(await listPublicEvents(queryObject(req))));
