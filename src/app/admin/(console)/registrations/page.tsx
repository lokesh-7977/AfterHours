import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/page-guards";
import { listRegistrations } from "@/modules/registrations/registration.service";
import { listAdminEvents } from "@/modules/events/event.service";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/modules/registrations/registration.constants";
import { EmptyState, PageHeader, Pagination, StatusBadge, formatDateTime, spObject } from "@/components/ui";
import { PassControls, PaymentDecision } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Registrations" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminRegistrationsPage({ searchParams }: Props) {
  const user = await requireAdminPage();
  const q = spObject(await searchParams);
  const [result, events] = await Promise.all([
    listRegistrations(user, { page: q.page, eventId: q.eventId, status: q.status, paymentStatus: q.paymentStatus }),
    listAdminEvents(user, { pageSize: 100 }),
  ]);

  return (
    <div>
      <PageHeader
        title="Registrations"
        description="Participant list with payment, pass and attendance state."
        actions={q.eventId ? <a className="btn btn-sm" href={`/api/v1/admin/events/${q.eventId}/attendees`}>Export CSV</a> : null}
      />
      <form className="mb-4 flex flex-wrap gap-2">
        <select className="input max-w-72" name="eventId" defaultValue={q.eventId ?? ""}>
          <option value="">All events</option>
          {events.items.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        <select className="input max-w-40" name="status" defaultValue={q.status ?? ""}>
          <option value="">Any status</option>
          <option value="registered">Registered</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
        <select className="input max-w-44" name="paymentStatus" defaultValue={q.paymentStatus ?? ""}>
          <option value="">Any payment</option>
          {["pending", "submitted", "approved", "rejected", "refunded"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>
      {result.items.length === 0 ? (
        <EmptyState title="No registrations match" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Participant</th>
                <th>Event</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{r.user?.name ?? "—"}</div>
                    <div className="muted text-xs">{r.user?.email}</div>
                    {r.user?.phone ? <div className="muted text-xs">{r.user.phone}</div> : null}
                  </td>
                  <td>
                    <div>{r.eventTitle}</div>
                    <div className="muted text-xs">{formatDateTime(r.createdAt)}</div>
                  </td>
                  <td className="space-y-1">
                    <StatusBadge status={r.status} plain />
                    {r.passStatus ? <div><StatusBadge status={r.passStatus} plain /> <span className="muted text-xs">pass</span></div> : null}
                    {r.attendanceStatus ? <div><StatusBadge status={r.attendanceStatus} /></div> : null}
                  </td>
                  <td>
                    <StatusBadge status={r.paymentStatus} />
                    <div className="muted mt-1 text-xs">
                      {formatMoney(r.amountMinor, r.currency)}
                      {r.paymentMethod ? ` · ${PAYMENT_METHOD_LABELS[r.paymentMethod]}` : ""}
                      {r.paymentReference ? ` · ${r.paymentReference}` : ""}
                    </div>
                  </td>
                  <td className="space-y-2">
                    <PaymentDecision registrationId={r.id} paymentStatus={r.paymentStatus} status={r.status} />
                    <PassControls registrationId={r.id} passStatus={r.passStatus} attendanceStatus={r.attendanceStatus} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/registrations" params={{ eventId: q.eventId, status: q.status, paymentStatus: q.paymentStatus }} />
    </div>
  );
}
