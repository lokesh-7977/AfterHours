import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { cancelMyRegistration } from "@/modules/registrations/registration.service";

export const POST = apiRoute<{ registrationId: string }>(async (_req, { params }) => ok(await cancelMyRegistration(await getSessionUser(), readId(params.registrationId, "Registration"))));
