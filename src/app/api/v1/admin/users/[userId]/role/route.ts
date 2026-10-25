import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { setUserRole } from "@/modules/users/user.service";

/** Super admin only; target sessions are revoked so the change applies immediately. */
export const PUT = apiRoute<{ userId: string }>(async (req, { params }) => ok(await setUserRole(await getSessionUser(), readId(params.userId, "User"), await readBody(req))));
