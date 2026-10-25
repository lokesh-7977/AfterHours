import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { errors } from "@/lib/errors";
import { approvePayment, refundPayment, rejectPayment } from "@/modules/payments/payment.service";

/** Manual payment decisions. Approval is idempotent and issues the QR pass. */
export const POST = apiRoute<{ registrationId: string; decision: string }>(async (req, { params }) => {
  const user = await getSessionUser();
  const id = readId(params.registrationId, "Registration");
  const input = await readBody(req);
  switch (params.decision) {
    case "approve":
      return ok(await approvePayment(user, id, input));
    case "reject":
      return ok(await rejectPayment(user, id, input));
    case "refund":
      return ok(await refundPayment(user, id, input));
    default:
      throw errors.notFound("Action");
  }
});
