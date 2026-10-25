import { apiRoute, ok, readJson } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { z } from "zod";
import { manualCheckIn } from "@/modules/attendance/attendance.service";

const body = z.object({ registrationId: z.uuid() });
export const POST = apiRoute(async (req) => ok(await manualCheckIn(await getSessionUser(), (await readJson(req, body)).registrationId)));
