import { ClipboardCheck, HeartHandshake, MessageCircleHeart } from "lucide-react";
import { TONE_STYLES, type FestivalTone } from "@/config/site";
import { Marker } from "./section-header";

const PRINCIPLES: { icon: typeof HeartHandshake; title: string; body: string; tone: FestivalTone }[] = [
  { icon: HeartHandshake, title: "Respect Everyone", body: "Treat fellow attendees, hosts and venue staff with kindness, and respect personal boundaries.", tone: "pink" },
  { icon: ClipboardCheck, title: "Follow Event Guidelines", body: "Each event page explains what to know before you go. Read it, and follow the instructions on the day.", tone: "marigold" },
  { icon: MessageCircleHeart, title: "Help Keep AfterHours Welcoming", body: "If something doesn't feel right, let the AfterHours event team know so it can be looked into.", tone: "peacock" },
];

/** A community guidelines link belongs here once that page is published. */
export function SafetySection() {
  return (
    <section aria-labelledby="safety-title" className="section pt-0">
      <div className="container-page">
        <div data-reveal className="relative overflow-hidden rounded-[2rem] bg-[var(--color-accent-soft)] px-5 py-10 sm:px-10 md:py-16 lg:px-14">
          <span data-float aria-hidden className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-[var(--fest-pink)] opacity-15" />
          <span data-float aria-hidden className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-[var(--fest-marigold)] opacity-20" />
          <div className="relative mx-auto max-w-2xl text-center md:mx-0 md:text-left">
            <h2 id="safety-title" data-split className="heading">
              Good experiences start with <Marker tone="pink">trust.</Marker>
            </h2>
            <p className="lede mt-4 text-[var(--color-ink-soft)]">
              We want every AfterHours event to be welcoming, respectful, and enjoyable. We encourage attendees to respect personal boundaries, follow event guidelines, and treat
              others with consideration.
            </p>
          </div>
          <ul data-stagger className="relative mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
            {PRINCIPLES.map(({ icon: Icon, title, body, tone }) => (
              <li key={title} className="flex flex-col items-center rounded-[1.5rem] bg-[var(--color-card)] p-6 text-center md:items-start md:text-left">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: TONE_STYLES[tone].solid, color: TONE_STYLES[tone].onSolid }}>
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-bold tracking-tight">{title}</h3>
                <p className="muted mt-1.5 text-[0.95rem] leading-relaxed">{body}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
