import { apiRoute, ok, readId, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { attendanceStats, listCheckIns } from "@/modules/attendance/attendance.service";

export const GET = apiRoute<{ eventId: string }>(async (req, { params }) => {
  const user = await getSessionUser();
  const eventId = readId(params.eventId, "Event");
  return ok({ stats: await attendanceStats(user, eventId), checkIns: await listCheckIns(user, eventId, queryObject(req)) });
});
