import type { Metadata } from "next";
import Link from "next/link";
import { requireParticipantPage } from "@/lib/page-guards";
import { listMyPasses } from "@/modules/passes/pass.service";
import { PASS_INVALID_MESSAGES } from "@/modules/passes/pass.policy";
import { Card, EmptyState, PageHeader, StatusBadge, formatDateTime } from "@/components/ui";
import { CodeCheckInForm } from "@/components/events/event-actions";

export const metadata: Metadata = { title: "My passes" };

export default async function MyPassesPage() {
  const user = await requireParticipantPage("/my-passes");
  const passes = await listMyPasses(user);
  return (
    <div className="container-page py-10">
      <PageHeader title="My passes" description="A pass is issued once an organizer verifies your payment. Show the QR at the entrance." />
      {passes.length === 0 ? (
        <EmptyState title="No passes yet">
          Passes appear here after payment approval. Check <Link className="link" href="/my-events">My events</Link> for payment status.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {passes.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{p.event?.title ?? "Event"}</h2>
                  <p className="muted text-sm">{formatDateTime(p.event?.startsAt)} · {p.event?.venueName}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={p.usable ? "active" : p.status === "revoked" ? "revoked" : "cancelled"} plain />
                  {p.attendanceStatus ? <StatusBadge status={p.attendanceStatus} /> : null}
                </div>
              </div>
              {p.usable ? (
                <div className="mt-4 space-y-4">
                  <Link href={`/my-passes/${p.id}`} className="btn btn-primary w-full">Show QR pass</Link>
                  {p.attendanceStatus !== "verified" && p.attendanceStatus !== "pending_confirmation" && p.event ? <CodeCheckInForm eventId={p.event.id} /> : null}
                  {p.attendanceStatus === "verified" && p.event ? <Link href={`/my-gallery/${p.event.id}`} className="btn w-full">Open gallery</Link> : null}
                </div>
              ) : (
                <p className="mt-4 text-sm text-[var(--color-danger)]">
                  {p.invalidReason ? PASS_INVALID_MESSAGES[p.invalidReason] : "Not valid"}
                  {p.revocationReason ? ` — ${p.revocationReason}` : ""}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
