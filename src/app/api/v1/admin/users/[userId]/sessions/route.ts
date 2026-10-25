import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { adminRevokeSessions } from "@/modules/users/user.service";

export const DELETE = apiRoute<{ userId: string }>(async (_req, { params }) => ok({ revoked: await adminRevokeSessions(await getSessionUser(), readId(params.userId, "User")) }));
