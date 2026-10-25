import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { errors } from "@/lib/errors";
import { confirmAttendance, revokeAttendance } from "@/modules/attendance/attendance.service";

/** Audited attendance corrections: confirm a pending code check-in or revoke a record. */
export const POST = apiRoute<{ attendanceId: string; action: string }>(async (req, { params }) => {
  const user = await getSessionUser();
  const id = readId(params.attendanceId, "Attendance");
  if (params.action === "confirm") return ok(await confirmAttendance(user, id));
  if (params.action === "revoke") return ok(await revokeAttendance(user, id, await readBody(req)));
  throw errors.notFound("Action");
});
