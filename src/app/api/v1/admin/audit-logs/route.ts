import { apiRoute, ok, readQuery } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { assertAdmin } from "@/modules/auth/policies";
import { auditQuerySchema, listAuditLogs } from "@/modules/audit/audit.service";

export const GET = apiRoute(async (req) => {
  assertAdmin(await getSessionUser());
  return ok(await listAuditLogs(readQuery(req, auditQuerySchema)));
});
