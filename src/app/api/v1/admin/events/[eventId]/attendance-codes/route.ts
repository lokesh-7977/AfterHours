import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { createAttendanceCode, listAttendanceCodes } from "@/modules/attendance/attendance.service";

export const GET = apiRoute<{ eventId: string }>(async (_req, { params }) => ok(await listAttendanceCodes(await getSessionUser(), readId(params.eventId, "Event"))));
/** Returns the plaintext code once; only its hash is stored. */
export const POST = apiRoute<{ eventId: string }>(async (req, { params }) => ok(await createAttendanceCode(await getSessionUser(), readId(params.eventId, "Event"), await readBody(req)), { status: 201 }));
