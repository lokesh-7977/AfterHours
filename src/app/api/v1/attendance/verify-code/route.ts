import { apiRoute, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { verifyAttendanceCode } from "@/modules/attendance/attendance.service";

export const POST = apiRoute(async (req) => ok(await verifyAttendanceCode(await getSessionUser(), await readBody(req))));
