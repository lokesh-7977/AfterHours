import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-guards";
import { listAdminEvents } from "@/modules/events/event.service";
import { formatMoney } from "@/lib/money";
import { Alert, EmptyState, PageHeader, Pagination, StatusBadge, formatDateTime, sp, spObject } from "@/components/ui";

export const metadata: Metadata = { title: "Manage events" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function AdminEventsPage({ searchParams }: Props) {
  const user = await requireAdminPage();
  const params = await searchParams;
  const query = spObject(params);
  const result = await listAdminEvents(user, { page: query.page, q: query.q, status: query.status });

  return (
    <div>
      <PageHeader title="Events" actions={<Link href="/admin/events/new" className="btn btn-primary">New event</Link>} />
      {sp(params, "deleted") ? <div className="mb-4"><Alert tone="green">Event deleted.</Alert></div> : null}
      <form className="mb-4 flex flex-wrap gap-2">
        <input className="input max-w-64" name="q" placeholder="Search title" defaultValue={query.q} />
        <select className="input max-w-44" name="status" defaultValue={query.status ?? ""}>
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="cancelled">Cancelled</option>
          <option value="completed">Completed</option>
        </select>
        <button className="btn">Filter</button>
      </form>
      {result.items.length === 0 ? (
        <EmptyState title="No events found" />
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Starts</th>
                <th>Status</th>
                <th>Seats</th>
                <th>Price</th>
                <th>Interested</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((e) => (
                <tr key={e.id}>
                  <td>
                    <Link className="link" href={`/admin/events/${e.id}`}>{e.title}</Link>
                    <div className="muted text-xs">{e.city}</div>
                  </td>
                  <td className="whitespace-nowrap">{formatDateTime(e.startsAt)}</td>
                  <td><StatusBadge status={e.status} plain /></td>
                  <td>{e.registeredCount}/{e.capacity}</td>
                  <td>{formatMoney(e.priceMinor, e.currency)}</td>
                  <td>{e.interestCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/events" params={{ q: query.q, status: query.status }} />
    </div>
  );
}
