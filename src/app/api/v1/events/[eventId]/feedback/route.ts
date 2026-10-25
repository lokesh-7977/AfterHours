import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { getMyFeedback, getPublicFeedbackSummary, submitFeedback } from "@/modules/feedback/feedback.service";

export const GET = apiRoute<{ eventId: string }>(async (_req, { params }) => {
  const eventId = readId(params.eventId, "Event");
  const user = await getSessionUser();
  return ok({ summary: await getPublicFeedbackSummary(eventId), mine: user ? await getMyFeedback(user.id, eventId) : null });
});
export const PUT = apiRoute<{ eventId: string }>(async (req, { params }) => ok(await submitFeedback(await getSessionUser(), readId(params.eventId, "Event"), await readBody(req))));
