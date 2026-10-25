import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { deleteComment, editComment } from "@/modules/comments/comment.service";

export const PATCH = apiRoute<{ commentId: string }>(async (req, { params }) => {
  await editComment(await getSessionUser(), readId(params.commentId, "Comment"), await readBody(req));
  return ok({ updated: true });
});
export const DELETE = apiRoute<{ commentId: string }>(async (_req, { params }) => {
  await deleteComment(await getSessionUser(), readId(params.commentId, "Comment"));
  return ok({ deleted: true });
});
