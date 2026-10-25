import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { moderateComment } from "@/modules/comments/comment.service";

export const POST = apiRoute<{ commentId: string }>(async (req, { params }) => {
  await moderateComment(await getSessionUser(), readId(params.commentId, "Comment"), await readBody(req));
  return ok({ moderated: true });
});
