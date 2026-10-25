import { apiRoute, ok, readId, readBody, queryObject } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { addComment, listComments } from "@/modules/comments/comment.service";

export const GET = apiRoute<{ eventId: string }>(async (req, { params }) => ok(await listComments(await getSessionUser(), readId(params.eventId, "Event"), queryObject(req))));
export const POST = apiRoute<{ eventId: string }>(async (req, { params }) => ok(await addComment(await getSessionUser(), readId(params.eventId, "Event"), await readBody(req)), { status: 201 }));
