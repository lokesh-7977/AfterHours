import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { moderateFeedback } from "@/modules/feedback/feedback.service";

export const POST = apiRoute<{ feedbackId: string }>(async (req, { params }) => {
  await moderateFeedback(await getSessionUser(), readId(params.feedbackId, "Feedback"), await readBody(req));
  return ok({ moderated: true });
});
