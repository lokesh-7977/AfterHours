import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Search } from "lucide-react";
import { listEventCities, listPublicEvents } from "@/modules/events/event.service";
import { CATEGORY_LABELS, EVENT_CATEGORIES } from "@/modules/events/event.constants";
import { cardInterestFor } from "@/components/events/card-interest";
import { EventGrid, EventStatePanel } from "@/components/events/event-grid";
import { FancyTitle, Pagination, sp, spObject } from "@/components/ui";
import { unstable_rethrow } from "next/navigation";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export const metadata: Metadata = {
  title: "Explore events",
  description: "Browse upcoming AfterHours events by category, city, date and price.",
};

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

const FILTER_KEYS = ["q", "category", "city", "when", "from", "price"] as const;

export default async function EventsPage({ searchParams }: Props) {
  await connection(); // results depend on the current time
  const params = await searchParams;
  const query = spObject(params);
  // "invalid" = bad filter values; "unavailable" = the event store couldn't be reached.
  const [listing, cities] = await Promise.all([
    listPublicEvents(query).then(
      (page) => ({ page, failure: null }),
      (err: unknown) => {
        unstable_rethrow(err);
        if (err instanceof AppError) return { page: null, failure: "invalid" as const };
        logger.error("events.list_failed", { err });
        return { page: null, failure: "unavailable" as const };
      },
    ),
    listEventCities().catch((err) => {
      unstable_rethrow(err);
      return [] as string[];
    }),
  ]);
  const result = listing.page;
  const failure = listing.failure;
  const filtered = FILTER_KEYS.some((k) => sp(params, k));
  const interestFor = await cardInterestFor(result?.items.map((e) => e.id) ?? []);
  const category = sp(params, "category");
  const q = sp(params, "q");
  const heading = q ? `Results for “${q}”` : category && category in CATEGORY_LABELS ? CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS] : "Explore events";

  return (
    <div className="container-page py-10 md:py-14">
      <FancyTitle>{heading}</FancyTitle>
      <p className="lede mt-3">Upcoming experiences in Hyderabad, curated and hosted by AfterHours.</p>

      <form className="mt-8 grid gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[1.6fr_repeat(5,minmax(0,1fr))_auto]" role="search" aria-label="Filter events">
        <div className="relative sm:col-span-2 lg:col-span-3 xl:col-span-1">
          <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-faint)]" />
          <input className="input pl-10" name="q" type="search" placeholder="Search events" defaultValue={sp(params, "q")} maxLength={100} aria-label="Search events" />
        </div>
        <select className="input" name="category" defaultValue={category ?? ""} aria-label="Category">
          <option value="">All categories</option>
          {EVENT_CATEGORIES.map((c) => (
            <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
          ))}
        </select>
        <select className="input" name="city" defaultValue={sp(params, "city") ?? ""} aria-label="City">
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select className="input" name="price" defaultValue={sp(params, "price") ?? ""} aria-label="Price">
          <option value="">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>
        <select className="input" name="when" defaultValue={sp(params, "when") ?? "upcoming"} aria-label="When">
          <option value="upcoming">Upcoming</option>
          <option value="past">Past</option>
          <option value="all">All dates</option>
        </select>
        <input className="input" type="date" name="from" defaultValue={sp(params, "from")} aria-label="On or after date" />
        <button className="btn btn-primary min-h-11">Search</button>
      </form>

      <div className="mb-5 mt-6 flex min-h-8 flex-wrap items-center justify-between gap-3 text-sm">
        <p className="muted" aria-live="polite">
          {result ? `${result.total} event${result.total === 1 ? "" : "s"}` : null}
        </p>
        {filtered ? <Link href="/events" className="link">Reset filters</Link> : null}
      </div>

      {!result && failure === "unavailable" ? (
        <EventStatePanel kind="error" title="Events couldn't be loaded" action={<Link href={`/events?${new URLSearchParams(query).toString()}`} className="btn">Try again</Link>}>
          Something went wrong on our side while fetching events. Give it a moment and try again.
        </EventStatePanel>
      ) : !result ? (
        <EventStatePanel kind="error" title="Some filters weren't valid" action={<Link href="/events" className="btn">Reset filters</Link>}>
          Check the date and try again, or reset the filters to see every upcoming event.
        </EventStatePanel>
      ) : result.items.length === 0 ? (
        filtered ? (
          <EventStatePanel kind="empty" title="No events match these filters" action={<Link href="/events" className="btn">Reset filters</Link>}>
            Try a different category, city or date.
          </EventStatePanel>
        ) : (
          <EventStatePanel kind="empty" title="Something exciting is in the works.">
            Check back soon for upcoming AfterHours experiences.
          </EventStatePanel>
        )
      ) : (
        <>
          <EventGrid events={result.items} interestFor={interestFor} />
          <Pagination page={result.page} totalPages={result.totalPages} basePath="/events" params={query} />
        </>
      )}
    </div>
  );
}
