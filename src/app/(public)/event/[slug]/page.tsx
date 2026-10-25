import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth-guards";
import { isAdminRole } from "@/modules/auth/roles";
import { getPublicEventBySlug } from "@/modules/events/event.service";
import { CATEGORY_LABELS } from "@/modules/events/event.constants";
import { formatMoney } from "@/lib/money";
import { REGISTRATION_BLOCK_MESSAGES } from "@/modules/events/event.policy";
import { isInterested } from "@/modules/interests/interest.service";
import { getMyRegistrationForEvent } from "@/modules/registrations/registration.service";
import { listComments } from "@/modules/comments/comment.service";
import { feedbackIneligibleReason, getMyFeedback, getPublicFeedbackSummary } from "@/modules/feedback/feedback.service";
import { Alert, Badge, Card, FancyTitle, StatusBadge, formatDateTime } from "@/components/ui";
import { CodeCheckInForm, FeedbackForm, InterestButton, RegisterButton } from "@/components/events/event-actions";
import { CommentsSection } from "@/components/events/comments";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const event = await getPublicEventBySlug(slug).catch(() => null);
  if (!event) return { title: "Event not found" };
  const description = event.summary || `${CATEGORY_LABELS[event.category]} event in ${event.city}.`;
  return {
    title: event.title,
    description,
    alternates: { canonical: `/event/${event.slug}` },
    openGraph: {
      type: "website",
      title: event.title,
      description,
      url: `/event/${event.slug}`,
      ...(event.posterUrl ? { images: [{ url: event.posterUrl, alt: event.title }] } : {}),
    },
  };
}

export default async function EventDetailPage({ params }: Props) {
  await connection(); // registration state depends on the current time
  const { slug } = await params;
  const [event, user] = await Promise.all([getPublicEventBySlug(slug), getSessionUser()]);
  if (!event) notFound();

  const participant = user && !isAdminRole(user.role) ? user : null;
  const [interested, registration, comments, feedbackSummary, myFeedback] = await Promise.all([
    participant ? isInterested(participant.id, event.id) : false,
    participant ? getMyRegistrationForEvent(participant, event.id) : null,
    listComments(user, event.id, { pageSize: 30 }),
    getPublicFeedbackSummary(event.id),
    participant ? getMyFeedback(participant.id, event.id) : null,
  ]);
  const activeReg = registration?.status === "registered" ? registration : null;
  const attended = registration?.attendanceStatus === "verified";
  const feedbackBlocked = feedbackIneligibleReason({ verifiedAttendee: attended, eventStatus: event.status, startsAt: new Date(event.startsAt) });

  return (
    <div className="container-page py-10">
      {event.status === "cancelled" ? (
        <div className="mb-6">
          <Alert tone="red">
            <strong>This event has been cancelled.</strong> {event.cancellationReason}
          </Alert>
        </div>
      ) : null}
      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-8">
          {event.posterUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.posterUrl} alt={`${event.title} poster`} className="max-h-[420px] w-full rounded-xl border border-[var(--color-line)] object-cover" />
          ) : null}
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge tone="green">{CATEGORY_LABELS[event.category]}</Badge>
              {event.tags.map((t) => (
                <Badge key={t}>#{t}</Badge>
              ))}
            </div>
            <FancyTitle className="mt-3">{event.title}</FancyTitle>
            <p className="muted mt-2">{event.summary}</p>
          </div>
          <section>
            <h2 className="mb-2 text-lg font-semibold">About this event</h2>
            <div className="prose-text">{event.description}</div>
          </section>
          {event.promoImageUrls.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {event.promoImageUrls.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" className="aspect-video w-full rounded-lg object-cover" loading="lazy" />
              ))}
            </div>
          ) : null}
          <section>
            <h2 className="mb-2 text-lg font-semibold">
              Feedback {feedbackSummary.averageRating ? <span className="muted text-sm font-normal">★ {feedbackSummary.averageRating} ({feedbackSummary.count})</span> : null}
            </h2>
            {feedbackSummary.recent.length ? (
              <ul className="space-y-3">
                {feedbackSummary.recent.map((f, i) => (
                  <li key={i} className="card py-3 text-sm">
                    <span className="text-[var(--color-warning)]">{"★".repeat(f.rating)}</span> <span className="muted">— {f.author}</span>
                    <p className="mt-1">{f.body}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="muted text-sm">No published feedback yet.</p>
            )}
            {participant && !feedbackBlocked ? (
              <Card className="mt-4">
                <h3 className="mb-2 font-semibold">Rate this event</h3>
                <FeedbackForm eventId={event.id} slug={event.slug} initial={myFeedback} />
              </Card>
            ) : null}
          </section>
          <section>
            <h2 className="mb-2 text-lg font-semibold">Discussion</h2>
            <CommentsSection eventId={event.id} slug={event.slug} comments={comments.items} signedIn={Boolean(user)} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="muted text-xs">When</dt>
                <dd>{formatDateTime(event.startsAt)} – {formatDateTime(event.endsAt)}</dd>
              </div>
              <div>
                <dt className="muted text-xs">Where</dt>
                <dd>
                  {event.venueName}
                  <br />
                  <span className="muted">{event.venueAddress}, {event.city}</span>
                  {event.location ? (
                    <a className="link ml-1 text-xs" href={`https://www.openstreetmap.org/?mlat=${event.location.lat}&mlon=${event.location.lng}#map=16/${event.location.lat}/${event.location.lng}`} target="_blank" rel="noopener noreferrer">
                      Map ↗
                    </a>
                  ) : null}
                </dd>
              </div>
              <div className="flex justify-between">
                <div>
                  <dt className="muted text-xs">Price</dt>
                  <dd className="text-lg font-bold">{formatMoney(event.priceMinor, event.currency)}</dd>
                </div>
                <div className="text-right">
                  <dt className="muted text-xs">Spots</dt>
                  <dd>{event.spotsLeft} / {event.capacity}</dd>
                </div>
              </div>
              <div>
                <dt className="muted text-xs">Registration</dt>
                <dd>{formatDateTime(event.registrationOpensAt)} – {formatDateTime(event.registrationClosesAt)}</dd>
              </div>
            </dl>
            <div className="mt-4 space-y-3">
              <InterestButton eventId={event.id} slug={event.slug} interested={interested} count={event.interestCount} signedIn={Boolean(participant)} />
              {user && isAdminRole(user.role) ? (
                <Link href={`/admin/events/${event.id}`} className="btn w-full">Manage event</Link>
              ) : activeReg ? (
                <div className="space-y-2 rounded-lg border border-[var(--color-line)] p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span>You&apos;re registered</span>
                    <StatusBadge status={activeReg.paymentStatus} />
                  </div>
                  {activeReg.paymentStatus === "approved" ? (
                    <Link href="/my-passes" className="btn btn-primary w-full">View my QR pass</Link>
                  ) : (
                    <Link href="/my-events" className="btn w-full">{activeReg.paymentStatus === "rejected" ? "Fix payment details" : "Payment & status"}</Link>
                  )}
                </div>
              ) : event.registrationBlockedReason ? (
                <p className="muted text-center text-sm">{REGISTRATION_BLOCK_MESSAGES[event.registrationBlockedReason]}</p>
              ) : participant ? (
                <RegisterButton eventId={event.id} slug={event.slug} label={event.priceMinor === 0 ? "Register (free)" : `Register · ${formatMoney(event.priceMinor, event.currency)}`} />
              ) : (
                <Link href={`/login?next=/event/${event.slug}`} className="btn btn-primary w-full">Log in to register</Link>
              )}
            </div>
          </Card>
          {activeReg?.paymentStatus === "approved" && event.allowCodeCheckIn && !attended && event.status === "published" ? (
            <Card>
              <h3 className="mb-2 font-semibold">At the venue?</h3>
              <CodeCheckInForm eventId={event.id} />
            </Card>
          ) : null}
          {attended && event.galleryEnabled ? (
            <Card>
              <p className="text-sm">✓ Attendance verified</p>
              <Link href={`/my-gallery/${event.id}`} className="btn btn-primary mt-3 w-full">Open private gallery</Link>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
