import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { submitPayment } from "@/modules/payments/payment.service";

/** Submit payment evidence for manual verification (never approves by itself). */
export const POST = apiRoute<{ registrationId: string }>(async (req, { params }) => ok(await submitPayment(await getSessionUser(), readId(params.registrationId, "Registration"), await readBody(req))));
