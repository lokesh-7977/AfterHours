import type { ReactNode } from "react";
import { CalendarSearch, CloudOff } from "lucide-react";
import type { EventSummaryDTO } from "@/modules/events/event.dto";
import { EventCard, type CardInterest } from "./event-card";

export function EventGrid({ events, interestFor }: { events: EventSummaryDTO[]; interestFor: (eventId: string) => CardInterest }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
      {events.map((e) => (
        <li key={e.id} className="grid">
          <EventCard event={e} interest={interestFor(e.id)} />
        </li>
      ))}
    </ul>
  );
}

export function EventGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6" aria-busy="true" aria-label="Loading events">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
          <div className="aspect-[3/2] animate-pulse bg-[var(--color-subtle)]" />
          <div className="space-y-3 p-5">
            <div className="h-5 w-3/4 animate-pulse rounded bg-[var(--color-subtle)]" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--color-subtle)]" />
            <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--color-subtle)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Empty and error states share one calm panel; `action` gives the next step. */
export function EventStatePanel({ kind, title, children, action }: { kind: "empty" | "error"; title: string; children: ReactNode; action?: ReactNode }) {
  const Icon = kind === "empty" ? CalendarSearch : CloudOff;
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-[var(--color-line-strong)] bg-[var(--color-card)] px-6 py-14 text-center" role={kind === "error" ? "alert" : undefined}>
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-accent-soft)] text-[var(--color-accent)]">
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <p className="mt-4 text-lg font-bold tracking-tight">{title}</p>
      <div className="muted mt-1 max-w-md text-sm leading-relaxed">{children}</div>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
