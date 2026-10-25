import { apiRoute, ok, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { getPass, getPassQrDataUrl } from "@/modules/passes/pass.service";

/** Owner or admin only. ?qr=1 includes the QR image while the pass is usable. */
export const GET = apiRoute<{ passId: string }>(async (req, { params }) => {
  const user = await getSessionUser();
  const passId = readId(params.passId, "Pass");
  if (req.nextUrl.searchParams.get("qr") === "1") return ok(await getPassQrDataUrl(user, passId));
  return ok({ pass: await getPass(user, passId) });
});
