import { apiRoute, ok, queryObject, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { createEvent, listAdminEvents } from "@/modules/events/event.service";

export const GET = apiRoute(async (req) => ok(await listAdminEvents(await getSessionUser(), queryObject(req))));
export const POST = apiRoute(async (req) => ok(await createEvent(await getSessionUser(), await readBody(req)), { status: 201 }));
