import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { revokeAttendanceCode } from "@/modules/attendance/attendance.service";

export const POST = apiRoute<{ codeId: string }>(async (_req, { params }) => ok(await revokeAttendanceCode(await getSessionUser(), readId(params.codeId, "Attendance code"))));
