import { BookmarkPlus, Compass, Inbox, LayoutGrid } from "lucide-react";
import { TONE_STYLES, type FestivalTone } from "@/config/site";
import { Marker } from "./section-header";

const FEATURES: { icon: typeof Compass; title: string; body: string; tone: FestivalTone }[] = [
  { icon: Compass, title: "Discover Something New", body: "Find experiences that match your interests, from social gatherings to workshops and creative events.", tone: "saffron" },
  { icon: LayoutGrid, title: "Everything in One Place", body: "Explore AfterHours' upcoming events without jumping between multiple platforms.", tone: "peacock" },
  { icon: BookmarkPlus, title: "Show Your Interest", body: "Express interest in events and keep track of the experiences you want to attend.", tone: "pink" },
  { icon: Inbox, title: "Stay in the Loop", body: "Access event details and important updates in one convenient place.", tone: "indigo" },
];

export function WhyAfterHours() {
  return (
    <section aria-labelledby="why-title" className="section bg-[var(--color-card)]">
      <div className="container-page grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-16">
        <div className="text-center lg:sticky lg:top-28 lg:self-start lg:text-left">
          <h2 id="why-title" data-split className="heading">
            More than a date on your <Marker tone="saffron">calendar.</Marker>
          </h2>
          <p data-reveal className="lede mt-4">AfterHours makes discovering and joining experiences feel simple, personal, and effortless.</p>
        </div>
        <ul data-stagger className="grid gap-4 sm:grid-cols-2 sm:gap-5">
          {FEATURES.map(({ icon: Icon, title, body, tone }) => (
            <li key={title} className="group relative flex flex-col items-center overflow-hidden rounded-[1.5rem] border border-[var(--color-line)] bg-[var(--color-canvas)] p-6 text-center sm:items-start sm:p-7 sm:text-left">
              <span aria-hidden className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60 transition-transform duration-500 group-hover:scale-125" style={{ background: TONE_STYLES[tone].soft }} />
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: TONE_STYLES[tone].solid, color: TONE_STYLES[tone].onSolid }}>
                <Icon aria-hidden className="h-6 w-6" strokeWidth={2} />
              </span>
              <h3 className="relative mt-5 text-xl font-bold tracking-tight">{title}</h3>
              <p className="muted relative mt-2 text-[0.95rem] leading-relaxed">{body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
