import { apiRoute, ok, readId, readBody } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { errors } from "@/lib/errors";
import { reissuePass, revokePass } from "@/modules/passes/pass.service";

export const POST = apiRoute<{ passId: string; action: string }>(async (req, { params }) => {
  const user = await getSessionUser();
  const id = readId(params.passId, "Pass");
  if (params.action === "revoke") return ok(await revokePass(user, id, await readBody(req)));
  if (params.action === "reissue") return ok(await reissuePass(user, id));
  throw errors.notFound("Action");
});
