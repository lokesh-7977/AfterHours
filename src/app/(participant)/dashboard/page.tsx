import type { Metadata } from "next";
import Link from "next/link";
import { requireParticipantPage } from "@/lib/page-guards";
import { listMyRegistrations } from "@/modules/registrations/registration.service";
import { listMyNotifications } from "@/modules/notifications/notification.service";
import { listMyInterests } from "@/modules/interests/interest.service";
import { Alert, Card, EmptyState, PageHeader, Stat, StatusBadge, formatDateTime, sp } from "@/components/ui";
import { MarkAllReadButton } from "@/components/participant/participant-forms";
import { EventCard } from "@/components/events/event-card";

export const metadata: Metadata = { title: "Dashboard" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function DashboardPage({ searchParams }: Props) {
  const user = await requireParticipantPage("/dashboard");
  const params = await searchParams;
  const [regs, notifications, interests] = await Promise.all([
    listMyRegistrations(user, { pageSize: 50 }),
    listMyNotifications(user, { page: 1, pageSize: 10 }),
    listMyInterests(user, { pageSize: 3 }),
  ]);
  const active = regs.items.filter((r) => r.status === "registered");
  const awaitingAction = active.filter((r) => r.paymentStatus === "pending" || r.paymentStatus === "rejected");

  return (
    <div className="container-page py-10">
      <PageHeader title={`Hi, ${user.name.split(" ")[0]}`} description="Your registrations, passes and updates at a glance." />
      {sp(params, "verified") ? (
        <div className="mb-6">
          <Alert tone="green">Your email is verified. Welcome aboard!</Alert>
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Active registrations" value={active.length} href="/my-events" />
        <Stat label="Need payment action" value={awaitingAction.length} href="/my-events" />
        <Stat label="Passes ready" value={active.filter((r) => r.passStatus === "active").length} href="/my-passes" />
        <Stat label="Galleries unlocked" value={regs.items.filter((r) => r.attendanceStatus === "verified").length} href="/my-gallery" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        <section>
          <h2 className="mb-3 text-lg font-semibold">Upcoming for you</h2>
          {active.length === 0 ? (
            <EmptyState title="No registrations yet">
              <Link className="link" href="/events">Find an event</Link>
            </EmptyState>
          ) : (
            <div className="space-y-3">
              {active.slice(0, 5).map((r) => (
                <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Link href={r.event ? `/event/${r.event.slug}` : "#"} className="font-semibold hover:underline">{r.event?.title ?? "Event removed"}</Link>
                    <p className="muted text-xs">{formatDateTime(r.event?.startsAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={r.paymentStatus} />
                    {r.passStatus === "active" ? <Link href="/my-passes" className="btn btn-primary btn-sm">Pass</Link> : <Link href="/my-events" className="btn btn-sm">Details</Link>}
                  </div>
                </Card>
              ))}
            </div>
          )}
          {interests.items.length ? (
            <>
              <h2 className="mb-3 mt-8 text-lg font-semibold">Events you&apos;re interested in</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {interests.items.map((e) => (
                  <EventCard key={e.id} event={e} interest={{ signedIn: true, interested: true }} />
                ))}
              </div>
            </>
          ) : null}
        </section>
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Notifications {notifications.unread ? <span className="muted text-sm">({notifications.unread} new)</span> : null}</h2>
            {notifications.unread ? <MarkAllReadButton /> : null}
          </div>
          {notifications.items.length === 0 ? (
            <p className="muted text-sm">Nothing yet.</p>
          ) : (
            <ul className="space-y-2">
              {notifications.items.map((n) => (
                <li key={n.id} className={`card py-3 text-sm ${n.readAt ? "opacity-70" : ""}`}>
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{n.title}</span>
                    {!n.readAt ? <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]" aria-label="unread" /> : null}
                  </div>
                  <p className="muted mt-1">{n.body}</p>
                  <div className="mt-1 flex justify-between text-xs">
                    <span className="muted">{formatDateTime(n.createdAt)}</span>
                    {n.link ? <Link className="link" href={n.link}>Open</Link> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
