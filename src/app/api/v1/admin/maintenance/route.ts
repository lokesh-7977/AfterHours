import { apiRoute, ok } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { getEnv } from "@/lib/env";
import { assertSuperAdmin } from "@/modules/auth/policies";
import { recordAudit } from "@/modules/audit/audit.service";
import { runMaintenance } from "@/modules/admin/maintenance.service";

/** Cron (Authorization: Bearer CRON_SECRET) or a signed-in super admin (origin-checked). */
export const POST = apiRoute(
  async (_req, { bearer }) => {
    if (!bearer) {
      const user = await getSessionUser();
      assertSuperAdmin(user);
      await recordAudit({ actor: user, action: "maintenance.run", entityType: "system" });
    }
    return ok(await runMaintenance());
  },
  { bearerSecret: () => getEnv().CRON_SECRET },
);
