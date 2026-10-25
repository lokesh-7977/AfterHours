import type { Metadata } from "next";
import Link from "next/link";
import { requireParticipantPage } from "@/lib/page-guards";
import { listMyAttendedEvents } from "@/modules/attendance/attendance.service";
import { EmptyState, PageHeader, formatDate } from "@/components/ui";

export const metadata: Metadata = { title: "My galleries" };

export default async function MyGalleryIndex() {
  const user = await requireParticipantPage("/my-gallery");
  const events = await listMyAttendedEvents(user);
  return (
    <div className="container-page py-10">
      <PageHeader title="Private galleries" description="Each gallery unlocks only after your attendance at that event is verified." />
      {events.length === 0 ? (
        <EmptyState title="No galleries unlocked yet">Check in at an event with your QR pass or the attendance code to unlock its gallery.</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => (
            <Link key={e.id} href={`/my-gallery/${e.id}`} className="card hover:border-[var(--color-faint)]">
              <p className="font-mono text-xs text-[var(--color-accent)]">{formatDate(e.startsAt)}</p>
              <p className="mt-1 font-semibold">{e.title}</p>
              <p className="muted text-sm">{e.city}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
