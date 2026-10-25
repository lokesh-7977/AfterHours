import { apiRoute, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { scanPass } from "@/modules/attendance/attendance.service";

/** Staff QR scanner. Admin only; the QR holds an opaque token. */
export const POST = apiRoute(async (req) => ok(await scanPass(await getSessionUser(), await readBody(req))));
