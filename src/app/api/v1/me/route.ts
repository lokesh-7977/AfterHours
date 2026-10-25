import { apiRoute, ok, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { errors } from "@/lib/errors";
import { updateProfile } from "@/modules/users/user.service";

export const GET = apiRoute(async () => {
  const user = await getSessionUser();
  if (!user) throw errors.unauthenticated();
  return ok(user);
});
export const PATCH = apiRoute(async (req) => ok(await updateProfile(await getSessionUser(), await readBody(req))));
