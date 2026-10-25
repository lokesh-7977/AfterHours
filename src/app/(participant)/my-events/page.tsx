import type { Metadata } from "next";
import Link from "next/link";
import { requireParticipantPage } from "@/lib/page-guards";
import { listMyRegistrations } from "@/modules/registrations/registration.service";
import { listMyInterests } from "@/modules/interests/interest.service";
import { formatMoney } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/modules/registrations/registration.constants";
import { Alert, Card, EmptyState, PageHeader, Pagination, StatusBadge, formatDateTime, sp } from "@/components/ui";
import { PaymentForm } from "@/components/participant/participant-forms";
import { CancelRegistrationButton } from "@/components/events/event-actions";
import { EventCard } from "@/components/events/event-card";
import type { MyRegistrationDTO } from "@/modules/registrations/registration.service";

export const metadata: Metadata = { title: "My events" };

function PaymentState({ r }: { r: MyRegistrationDTO }) {
  switch (r.paymentStatus) {
    case "pending":
      return <Alert tone="amber">Complete the payment using the organizer&apos;s instructions, then submit the reference below.</Alert>;
    case "submitted":
      return <Alert tone="blue">Payment submitted {formatDateTime(r.paymentSubmittedAt)} ({PAYMENT_METHOD_LABELS[r.paymentMethod ?? "other"]} · {r.paymentReference}). Waiting for an organizer to verify it.</Alert>;
    case "rejected":
      return <Alert tone="red">Payment could not be verified: {r.rejectionReason}. Submit corrected details below.</Alert>;
    case "approved":
      return <Alert tone="green">Payment approved {r.paymentMethod === "free" ? "(free event)" : formatDateTime(r.paymentVerifiedAt)}. Your pass is ready.</Alert>;
    case "refunded":
      return <Alert tone="amber">Refunded {formatDateTime(r.refundedAt)}. This registration is closed.</Alert>;
  }
}

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MyEventsPage({ searchParams }: Props) {
  const user = await requireParticipantPage("/my-events");
  const params = await searchParams;
  const page = sp(params, "page") ?? "1";
  const [regs, interests] = await Promise.all([listMyRegistrations(user, { page, pageSize: 10 }), listMyInterests(user, { pageSize: 12 })]);

  return (
    <div className="container-page py-10">
      <PageHeader title="My events" description="Registrations, payment status and events you are interested in." />
      {regs.items.length === 0 ? (
        <EmptyState title="You haven't registered for anything yet">
          <Link className="link" href="/events">Explore events</Link>
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {regs.items.map((r) => (
            <Card key={r.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {r.event ? <Link href={`/event/${r.event.slug}`} className="text-lg font-semibold hover:underline">{r.event.title}</Link> : <span className="text-lg font-semibold">Event no longer available</span>}
                  <p className="muted text-sm">
                    {formatDateTime(r.event?.startsAt)} · {r.event?.venueName}, {r.event?.city} · {formatMoney(r.amountMinor, r.currency)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusBadge status={r.status} plain />
                  {r.status === "registered" ? <StatusBadge status={r.paymentStatus} /> : null}
                  {r.event?.status === "cancelled" ? <StatusBadge status="cancelled" /> : null}
                  {r.passStatus === "revoked" ? <StatusBadge status="revoked" /> : null}
                  {r.attendanceStatus ? <StatusBadge status={r.attendanceStatus} /> : null}
                </div>
              </div>
              {r.status === "registered" ? (
                <div className="mt-4 space-y-4">
                  {r.event?.status === "cancelled" ? <Alert tone="red">This event was cancelled. The organizers will contact you about refunds.</Alert> : <PaymentState r={r} />}
                  {r.paymentInstructions && r.paymentStatus !== "approved" ? (
                    <div className="rounded-lg bg-[var(--color-subtle)] p-3 text-sm">
                      <p className="label">How to pay</p>
                      <p className="prose-text">{r.paymentInstructions}</p>
                    </div>
                  ) : null}
                  {["pending", "submitted", "rejected"].includes(r.paymentStatus) && r.event?.status === "published" ? (
                    <details open={r.paymentStatus !== "submitted"}>
                      <summary className="cursor-pointer text-sm font-semibold">{r.paymentStatus === "submitted" ? "Update payment details" : "Submit payment details"}</summary>
                      <div className="mt-3">
                        <PaymentForm registrationId={r.id} eventId={r.eventId} defaults={{ method: r.paymentMethod, reference: r.paymentReference }} />
                      </div>
                    </details>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    {r.passStatus === "active" ? <Link className="btn btn-primary btn-sm" href="/my-passes">View QR pass</Link> : null}
                    {r.attendanceStatus === "verified" ? <Link className="btn btn-sm" href={`/my-gallery/${r.eventId}`}>Gallery</Link> : null}
                    {r.paymentStatus !== "approved" ? <CancelRegistrationButton registrationId={r.id} /> : null}
                  </div>
                </div>
              ) : null}
            </Card>
          ))}
          <Pagination page={regs.page} totalPages={regs.totalPages} basePath="/my-events" params={{}} />
        </div>
      )}
      <h2 className="mb-3 mt-10 text-lg font-semibold">Interested</h2>
      {interests.items.length === 0 ? (
        <p className="muted text-sm">Select “Express Interest” on an event to keep track of it here. Interest is not a registration.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {interests.items.map((e) => (
            <EventCard key={e.id} event={e} interest={{ signedIn: true, interested: true }} />
          ))}
        </div>
      )}
    </div>
  );
}
