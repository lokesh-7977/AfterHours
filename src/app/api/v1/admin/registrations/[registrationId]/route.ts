import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { getAdminRegistration } from "@/modules/registrations/registration.service";

export const GET = apiRoute<{ registrationId: string }>(async (_req, { params }) => ok(await getAdminRegistration(await getSessionUser(), readId(params.registrationId, "Registration"))));
