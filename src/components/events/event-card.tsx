import Link from "next/link";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import type { EventSummaryDTO } from "@/modules/events/event.dto";
import { CATEGORY_LABELS } from "@/modules/events/event.constants";
import { formatMoney } from "@/lib/money";
import { AfterHoursIcon } from "@/components/branding/afterhours-icon";
import { InterestButton } from "./event-actions";
import { eventDay, eventTime } from "./event-format";

/** How the viewer can act on interest: null hides the action (admins, or events that ended). */
export type CardInterest = { signedIn: boolean; interested: boolean } | null;

/** Public availability: `closed` covers cancelled, ended and sold-out events. */
export function eventAvailability(event: EventSummaryDTO): { label: string; tone: "open" | "low" | "closed" } {
  if (event.status === "cancelled") return { label: "Cancelled", tone: "closed" };
  if (event.status === "completed" || new Date(event.endsAt) < new Date()) return { label: "Ended", tone: "closed" };
  if (event.spotsLeft <= 0) return { label: "Sold out", tone: "closed" };
  if (event.spotsLeft <= Math.max(5, event.capacity * 0.15)) return { label: `Only ${event.spotsLeft} spots left`, tone: "low" };
  return { label: `${event.spotsLeft} spots left`, tone: "open" };
}

export function EventCover({ event, className = "" }: { event: EventSummaryDTO; className?: string }) {
  return (
    <div className={`relative overflow-hidden bg-[var(--color-accent-soft)] ${className}`}>
      {event.posterThumbUrl ? (
        // Posters are served by our authorized media route; next/image optimisation is not used for it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.posterThumbUrl} alt="" className="zoom-img h-full w-full object-cover" loading="lazy" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[var(--color-accent)] opacity-40">
          <AfterHoursIcon variant="mono" className="h-16 w-16" />
        </div>
      )}
    </div>
  );
}

export function EventCard({ event, interest, headingLevel = "h3" }: { event: EventSummaryDTO; interest: CardInterest; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  const availability = eventAvailability(event);
  const canShowInterest = interest !== null && event.status === "published" && availability.tone !== "closed";
  return (
    <article className="zoom-parent lift relative flex flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
      <div className="relative">
        <EventCover event={event} className="aspect-[3/2]" />
        <span className="badge absolute left-3 top-3 bg-[var(--color-card)] text-[var(--color-ink)] shadow-sm">{CATEGORY_LABELS[event.category]}</span>
        {availability.tone === "closed" ? (
          <span className="badge absolute right-3 top-3 bg-[var(--color-ink)] text-[var(--color-canvas)]">{availability.label}</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <Heading className="text-lg font-bold leading-snug tracking-tight">
          {/* Stretched link: the whole card opens the event; the interest button sits above it. */}
          <Link href={`/event/${event.slug}`} className="after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-[var(--color-primary)]">
            {event.title}
          </Link>
        </Heading>
        <dl className="mt-3 space-y-1.5 text-sm text-[var(--color-ink-soft)]">
          <div className="flex flex-wrap gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Date</dt>
              <CalendarDays aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
              <dd>{eventDay(event.startsAt)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="sr-only">Time</dt>
              <Clock aria-hidden className="h-4 w-4 shrink-0 text-[var(--color-muted)]" />
              <dd>{eventTime(event.startsAt)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <dt className="sr-only">Location</dt>
            <MapPin aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted)]" />
            <dd>
              {event.venueName}, {event.city}
            </dd>
          </div>
        </dl>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-5">
          <div className="text-sm">
            <p className="text-base font-bold">{formatMoney(event.priceMinor, event.currency)}</p>
            {availability.tone !== "closed" ? (
              <p className={availability.tone === "low" ? "font-semibold text-[var(--color-warning)]" : "muted"}>{availability.label}</p>
            ) : null}
          </div>
          {canShowInterest ? (
            <InterestButton compact eventId={event.id} slug={event.slug} interested={interest.interested} count={event.interestCount} signedIn={interest.signedIn} />
          ) : null}
        </div>
      </div>
    </article>
  );
}
