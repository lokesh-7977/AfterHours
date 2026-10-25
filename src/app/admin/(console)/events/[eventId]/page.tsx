import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/page-guards";
import { AppError } from "@/lib/errors";
import { isUuidV7 } from "@/lib/ids";
import { isR2Configured } from "@/lib/env";
import { getAdminEvent } from "@/modules/events/event.service";
import { getEventStats } from "@/modules/admin/stats.service";
import { Alert, Card, PageHeader, StatusBadge, sp } from "@/components/ui";
import { EventForm, EventStatusControls, PosterManager } from "@/components/admin/event-form";

export const metadata: Metadata = { title: "Edit event" };

type Props = { params: Promise<{ eventId: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

function Counts({ label, data }: { label: string; data: Partial<Record<string, number>> }) {
  const entries = Object.entries(data);
  return (
    <div>
      <p className="muted text-xs">{label}</p>
      {entries.length === 0 ? <p className="text-sm">—</p> : <p className="text-sm">{entries.map(([k, v]) => `${k.replace("_", " ")}: ${v}`).join(" · ")}</p>}
    </div>
  );
}

export default async function AdminEventPage({ params, searchParams }: Props) {
  const user = await requireAdminPage();
  const { eventId } = await params;
  if (!isUuidV7(eventId)) notFound();
  const query = await searchParams;
  let event: Awaited<ReturnType<typeof getAdminEvent>>;
  try {
    event = await getAdminEvent(user, eventId);
  } catch (err) {
    if (err instanceof AppError && err.code === "NOT_FOUND") notFound();
    throw err;
  }
  const stats = await getEventStats(user, eventId);
  const editable = event.status === "draft" || event.status === "published";

  return (
    <div className="space-y-6">
      <PageHeader
        title={event.title}
        description={
          <span className="flex items-center gap-2">
            <StatusBadge status={event.status} plain /> {event.status !== "draft" ? <Link className="link" href={`/event/${event.slug}`}>View public page</Link> : null}
          </span>
        }
        actions={
          <>
            <Link className="btn btn-sm" href={`/admin/registrations?eventId=${event.id}`}>Registrations</Link>
            <Link className="btn btn-sm" href={`/admin/attendance?eventId=${event.id}`}>Attendance</Link>
            <a className="btn btn-sm" href={`/api/v1/admin/events/${event.id}/attendees`}>Export CSV</a>
          </>
        }
      />
      {sp(query, "created") ? <Alert tone="green">Draft created. Upload a poster, then publish when ready.</Alert> : null}
      {event.status === "cancelled" ? <Alert tone="red">Cancelled: {event.cancellationReason}</Alert> : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <h2 className="mb-3 font-semibold">Lifecycle</h2>
          <EventStatusControls eventId={event.id} status={event.status} />
        </Card>
        <Card>
          <h2 className="mb-3 font-semibold">Poster</h2>
          {isR2Configured() ? (
            editable ? <PosterManager eventId={event.id} posterUrl={event.posterUrl} /> : <p className="muted text-sm">Locked for {event.status} events.</p>
          ) : (
            <p className="muted text-sm">Configure Cloudflare R2 to upload posters.</p>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-semibold">Statistics</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Counts label="Registrations" data={stats.registrations} />
          <Counts label="Payments" data={stats.payments} />
          <Counts label="Passes" data={stats.passes} />
          <Counts label="Attendance" data={stats.attendance} />
          <div>
            <p className="muted text-xs">Feedback</p>
            <p className="text-sm">{stats.feedback.average ? `★ ${stats.feedback.average} (${stats.feedback.count})` : "—"}</p>
          </div>
          <div>
            <p className="muted text-xs">Gallery</p>
            <p className="text-sm">{stats.media.approved} approved · {stats.media.pending} pending</p>
          </div>
          <div>
            <p className="muted text-xs">Seats</p>
            <p className="text-sm">{event.registeredCount} / {event.capacity} · {event.interestCount} interested</p>
          </div>
        </div>
      </Card>

      {editable ? (
        <>
          <h2 className="text-lg font-semibold">Edit details</h2>
          <EventForm initial={{ ...event, id: event.id }} />
        </>
      ) : null}
    </div>
  );
}
