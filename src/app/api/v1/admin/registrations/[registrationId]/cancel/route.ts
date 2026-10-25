import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { adminCancelRegistration } from "@/modules/registrations/registration.service";

export const POST = apiRoute<{ registrationId: string }>(async (req, { params }) => ok(await adminCancelRegistration(await getSessionUser(), readId(params.registrationId, "Registration"), await readBody(req))));
