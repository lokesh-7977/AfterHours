import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-guards";
import { getDashboardStats } from "@/modules/admin/stats.service";
import { formatMoney } from "@/lib/money";
import { Alert, Card, PageHeader, Stat, StatusBadge, formatDateTime, sp } from "@/components/ui";

export const metadata: Metadata = { title: "Admin dashboard" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminDashboard({ searchParams }: Props) {
  const user = await requireAdminPage();
  const params = await searchParams;
  const s = await getDashboardStats(user);
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard" description={`Signed in as ${user.email} (${user.role.replace("_", " ")})`} actions={<Link href="/admin/events/new" className="btn btn-primary">New event</Link>} />
      {sp(params, "error") ? <Alert tone="amber">That area requires super admin privileges.</Alert> : null}

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Events" value={s.events.total} hint={`${s.events.published} published · ${s.events.drafts} drafts`} href="/admin/events" />
        <Stat label="Upcoming" value={s.events.upcoming} hint={`${s.events.cancelled} cancelled`} />
        <Stat label="Registrations" value={s.registrations.total} hint={`${s.registrations.active} active`} href="/admin/registrations" />
        <Stat label="Capacity used" value={pct(s.capacity.utilization)} hint={`${s.capacity.seatsTaken} / ${s.capacity.seatsTotal} seats (published)`} />
        <Stat label="Awaiting verification" value={s.payments.submitted} hint={`${s.payments.pending} not yet submitted`} href="/admin/payments" />
        <Stat label="Approved payments" value={s.payments.approved} hint={`${s.payments.rejected} rejected · ${s.payments.refunded} refunded`} />
        <Stat label="Passes issued" value={s.passes.active} hint={`${s.passes.revoked} revoked`} />
        <Stat label="Checked in" value={s.attendance.verified} hint={`${s.attendance.pending} awaiting confirmation`} href="/admin/attendance" />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Media to review" value={s.moderation.mediaPending} href="/admin/media" />
        <Stat label="Flagged comments" value={s.moderation.commentsFlagged} href="/admin/feedback?tab=comments" />
        <Stat label="Feedback to review" value={s.moderation.feedbackPending} href="/admin/feedback" />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Capacity — upcoming events</h2>
          {s.topEvents.length === 0 ? (
            <p className="muted text-sm">No upcoming published events.</p>
          ) : (
            <ul className="space-y-3 text-sm">
              {s.topEvents.map((e) => (
                <li key={e.id}>
                  <div className="flex justify-between gap-2">
                    <Link className="link truncate" href={`/admin/events/${e.id}`}>{e.title}</Link>
                    <span className="muted shrink-0">{e.registeredCount}/{e.capacity}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded bg-[var(--color-surface)]">
                    <div className="h-full bg-[var(--color-accent)]" style={{ width: `${Math.min(100, (e.registeredCount / e.capacity) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent check-ins</h2>
          {s.recentCheckIns.length === 0 ? (
            <p className="muted text-sm">No check-ins yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {s.recentCheckIns.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">{c.user?.name ?? "—"} <span className="muted">· {c.method.replace("_", " ")}</span></span>
                  <span className="flex shrink-0 items-center gap-2"><StatusBadge status={c.status} /><span className="muted text-xs">{formatDateTime(c.checkedInAt)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent registrations</h2>
          <ul className="space-y-2 text-sm">
            {s.recentRegistrations.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="truncate">{r.user?.name ?? "—"} <span className="muted">→ {r.eventTitle}</span></span>
                <StatusBadge status={r.paymentStatus} />
              </li>
            ))}
            {s.recentRegistrations.length === 0 ? <li className="muted">None yet.</li> : null}
          </ul>
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Recent payment decisions</h2>
          <ul className="space-y-2 text-sm">
            {s.recentDecisions.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="truncate">{r.user?.name ?? "—"} <span className="muted">· {formatMoney(r.amountMinor, r.currency)}</span></span>
                <span className="flex shrink-0 items-center gap-2"><StatusBadge status={r.paymentStatus} plain /><span className="muted text-xs">{formatDateTime(r.paymentVerifiedAt)}</span></span>
              </li>
            ))}
            {s.recentDecisions.length === 0 ? <li className="muted">None yet.</li> : null}
          </ul>
        </Card>
      </section>
    </div>
  );
}
