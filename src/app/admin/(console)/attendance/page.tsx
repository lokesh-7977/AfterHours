import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-guards";
import { isUuidV7 } from "@/lib/ids";
import { listAdminEvents } from "@/modules/events/event.service";
import { attendanceStats, listAttendanceCodes, listCheckIns } from "@/modules/attendance/attendance.service";
import { Card, EmptyState, PageHeader, Pagination, Stat, StatusBadge, formatDateTime, spObject } from "@/components/ui";
import { AttendanceCorrection, CodeGenerator, RevokeCodeButton } from "@/components/admin/admin-actions";
import { QrCheckInScanner } from "@/components/admin/qr-scanner";

export const metadata: Metadata = { title: "Attendance" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AttendancePage({ searchParams }: Props) {
  const user = await requireAdminPage();
  const q = spObject(await searchParams);
  const events = await listAdminEvents(user, { status: "published", pageSize: 100 });
  const eventId = q.eventId && isUuidV7(q.eventId) ? q.eventId : events.items[0]?.id;

  const picker = (
    <form className="flex gap-2">
      <select className="input max-w-80" name="eventId" defaultValue={eventId ?? ""}>
        {events.items.map((e) => (
          <option key={e.id} value={e.id}>{e.title}</option>
        ))}
      </select>
      <button className="btn">Open</button>
    </form>
  );
  if (!eventId) {
    return (
      <div>
        <PageHeader title="Attendance" />
        <EmptyState title="No published events">Publish an event to manage check-ins.</EmptyState>
      </div>
    );
  }
  const [stats, codes, checkIns] = await Promise.all([
    attendanceStats(user, eventId),
    listAttendanceCodes(user, eventId),
    listCheckIns(user, eventId, { page: q.page, status: q.status }),
  ]);
  const event = events.items.find((e) => e.id === eventId);

  return (
    <div className="space-y-6">
      <PageHeader title="Attendance" description={event?.attendanceSettings.requireStaffConfirmation ? "Strict mode: code check-ins require staff confirmation." : "QR scans verify instantly; shared codes can be forwarded remotely, so use strict mode when venue presence matters."} actions={picker} />
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Checked in" value={stats.verified} />
        <Stat label="Awaiting confirmation" value={stats.pending} href={`/admin/attendance?eventId=${eventId}&status=pending_confirmation`} />
        <Stat label="Approved registrations" value={stats.approvedRegistrations} />
        <Stat label="Turnout" value={`${Math.round(stats.rate * 100)}%`} />
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Scan QR passes</h2>
        <QrCheckInScanner eventId={eventId} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-semibold">Shared attendance code</h2>
          {event?.attendanceSettings.allowCodeCheckIn ? <CodeGenerator eventId={eventId} /> : <p className="muted text-sm">Code check-in is disabled for this event.</p>}
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Codes</h2>
          {codes.length === 0 ? (
            <p className="muted text-sm">No codes generated.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {codes.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span>
                    {c.label ?? "Code"} <span className="muted">· {c.useCount}{c.maxUses ? `/${c.maxUses}` : ""} uses · expires {formatDateTime(c.expiresAt)}</span>
                  </span>
                  {c.usable ? <RevokeCodeButton codeId={c.id} /> : <StatusBadge status={c.revokedAt ? "revoked" : "expired"} plain />}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">Check-ins</h2>
          <form className="flex gap-2">
            <input type="hidden" name="eventId" value={eventId} />
            <select className="input text-sm" name="status" defaultValue={q.status ?? ""}>
              <option value="">All</option>
              <option value="verified">Verified</option>
              <option value="pending_confirmation">Pending</option>
              <option value="revoked">Revoked</option>
            </select>
            <button className="btn btn-sm">Filter</button>
          </form>
        </div>
        {checkIns.items.length === 0 ? (
          <EmptyState title="No check-ins yet" />
        ) : (
          <div className="card overflow-x-auto p-0">
            <table className="table">
              <thead>
                <tr>
                  <th>Attendee</th>
                  <th>Method</th>
                  <th>Status</th>
                  <th>Time</th>
                  <th>Correction</th>
                </tr>
              </thead>
              <tbody>
                {checkIns.items.map((c) => (
                  <tr key={c.id}>
                    <td>{c.user?.name}<div className="muted text-xs">{c.user?.email}</div></td>
                    <td>{c.method.replace("_", " ")}</td>
                    <td><StatusBadge status={c.status} />{c.revocationReason ? <div className="muted text-xs">{c.revocationReason}</div> : null}</td>
                    <td className="whitespace-nowrap">{formatDateTime(c.checkedInAt)}</td>
                    <td><AttendanceCorrection attendanceId={c.id} status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={checkIns.page} totalPages={checkIns.totalPages} basePath="/admin/attendance" params={{ eventId, status: q.status }} />
      </section>
    </div>
  );
}
