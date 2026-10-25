"use server";

import { runAction, type ActionResult } from "@/lib/action";
import { getSessionUser } from "@/lib/auth-guards";
import { addComment, deleteComment, editComment, reportComment } from "@/modules/comments/comment.service";

export async function addCommentAction(eventId: string, slug: string, parentId: string | null, _prev: ActionResult<unknown> | null, fd: FormData): Promise<ActionResult<unknown>> {
  return runAction(async () => addComment(await getSessionUser(), eventId, { body: fd.get("body"), parentId: parentId ?? undefined }), { revalidate: [`/event/${slug}`] });
}

export async function editCommentAction(commentId: string, slug: string, body: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await editComment(await getSessionUser(), commentId, { body });
    return null;
  }, { revalidate: [`/event/${slug}`] });
}

/** Used by authors (event page, pass `slug`) and by moderators (admin console). */
export async function deleteCommentAction(commentId: string, slug?: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await deleteComment(await getSessionUser(), commentId);
    return null;
  }, { revalidate: slug ? [`/event/${slug}`] : ["/admin/feedback"] });
}

export async function reportCommentAction(commentId: string, reason: string): Promise<ActionResult<null>> {
  return runAction(async () => {
    await reportComment(await getSessionUser(), commentId, { reason });
    return null;
  }, { message: "Thanks — moderators will review it" });
}
