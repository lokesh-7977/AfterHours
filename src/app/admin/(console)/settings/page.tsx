import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-guards";
import { getEnv, isR2Configured } from "@/lib/env";
import { transactionsSupported } from "@/lib/transactions";
import { listAuditLogs } from "@/modules/audit/audit.service";
import { Card, PageHeader, Pagination, formatDateTime, spObject } from "@/components/ui";
import { MaintenanceButton } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Settings & audit" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function SettingsPage({ searchParams }: Props) {
  const user = await requireAdminPage();
  const q = spObject(await searchParams);
  const logs = await listAuditLogs({ page: Number(q.page ?? 1) || 1, pageSize: 30, action: q.action || undefined });
  const env = getEnv();
  const tx = transactionsSupported();

  return (
    <div className="space-y-6">
      <PageHeader title="Settings & audit log" />
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-2 text-sm">
          <h2 className="font-semibold">Configuration status</h2>
          <p>Media storage (R2): <strong>{isR2Configured(env) ? "configured" : "not configured"}</strong></p>
          <p>Email provider: <strong>{env.EMAIL_PROVIDER}</strong>{env.EMAIL_PROVIDER === "console" ? " (emails are logged, not delivered)" : ""}</p>
          <p>Email verification required: <strong>{env.REQUIRE_EMAIL_VERIFICATION ? "yes" : "no"}</strong></p>
          <p>MongoDB transactions: <strong>{tx === undefined ? "not yet probed" : tx ? "available" : "unavailable (idempotent fallback)"}</strong> · mode {env.MONGODB_TRANSACTIONS}</p>
          <p>Scheduled maintenance endpoint: <strong>{env.CRON_SECRET ? "enabled" : "set CRON_SECRET to enable"}</strong></p>
        </Card>
        <Card className="space-y-2 text-sm">
          <h2 className="font-semibold">Maintenance</h2>
          <p className="muted">Reconciles passes, completes ended events, queues reminders, retries emails and cleans up abandoned/orphaned uploads. Schedule hourly via cron.</p>
          {user.role === "super_admin" ? <MaintenanceButton /> : <p className="muted">Super admins can run it manually.</p>}
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Audit log</h2>
          <form className="flex gap-2">
            <input className="input text-sm" name="action" placeholder="Filter action, e.g. payment.approve" defaultValue={q.action} />
            <button className="btn btn-sm">Filter</button>
          </form>
        </div>
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Entity</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.items.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td className="font-mono text-xs">{l.action}</td>
                  <td className="text-xs">{l.actorRole ?? "system"}<div className="muted font-mono">{l.actorId?.slice(0, 8)}</div></td>
                  <td className="text-xs">{l.entityType}<div className="muted font-mono">{l.entityId?.slice(0, 8)}</div></td>
                  <td className="max-w-xs truncate font-mono text-xs">{Object.keys(l.metadata).length ? JSON.stringify(l.metadata) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={logs.page} totalPages={logs.totalPages} basePath="/admin/settings" params={{ action: q.action }} />
      </section>
    </div>
  );
}
