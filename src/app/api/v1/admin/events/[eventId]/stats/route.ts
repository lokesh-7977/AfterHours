import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { getEventStats } from "@/modules/admin/stats.service";

export const GET = apiRoute<{ eventId: string }>(async (_req, { params }) => ok(await getEventStats(await getSessionUser(), readId(params.eventId, "Event"))));
