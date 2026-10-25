import { Sparkle } from "lucide-react";
import { TONE_STYLES, type FestivalTone } from "@/config/site";

/** Kinds of experiences AfterHours hosts in Hyderabad (not specific events). */
const KINDS: [string, FestivalTone][] = [
  ["House parties", "pink"],
  ["Board game nights", "marigold"],
  ["Blind dates", "saffron"],
  ["DJ nights", "indigo"],
  ["Dance floors", "peacock"],
  ["Open mics", "pink"],
  ["Rooftop sundowners", "saffron"],
  ["Holi bashes", "marigold"],
  ["Biryani crawls", "peacock"],
];

/** Mood notes, written like scribbles on a flyer. */
const NOTES: [string, FestivalTone][] = [
  ["phones down, vibes up", "pink"],
  ["dance like no one's filming", "peacock"],
  ["bring your A-game", "marigold"],
  ["say yes to the plan", "indigo"],
  ["find your people", "saffron"],
  ["one more round?", "pink"],
  ["good music only", "peacock"],
  ["main character energy", "marigold"],
];

function KindsRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {KINDS.map(([label, tone]) => (
        <li key={label} className="flex items-center">
          <span className="whitespace-nowrap px-6 font-[family-name:var(--font-display)] text-4xl italic md:text-6xl" style={{ color: TONE_STYLES[tone].text }}>
            {label}
          </span>
          <Sparkle aria-hidden className="h-5 w-5 shrink-0 fill-current" style={{ color: TONE_STYLES[tone].solid }} />
        </li>
      ))}
    </ul>
  );
}

function NotesRow({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul className="flex shrink-0 items-center gap-4 pr-4" aria-hidden={hidden || undefined}>
      {NOTES.map(([note, tone], i) => (
        <li
          key={note}
          className={`hand whitespace-nowrap rounded-full px-5 py-2 text-xl ${i % 2 ? "rotate-2" : "-rotate-2"}`}
          style={{ background: TONE_STYLES[tone].soft, color: TONE_STYLES[tone].text }}
        >
          {note}
        </li>
      ))}
    </ul>
  );
}

export function ExperienceMarquee() {
  return (
    <section aria-label="Kinds of experiences on AfterHours" className="relative overflow-hidden border-y border-[var(--color-line)] bg-[var(--color-card)] py-8 md:py-10">
      {/* Each track holds two identical rows; GSAP slides it by half its width on a loop, rows in opposite directions. */}
      <div data-marquee="40" className="flex w-max">
        <KindsRow />
        <KindsRow hidden />
      </div>
      <div data-marquee="55" data-marquee-dir="right" className="mt-6 flex w-max">
        <NotesRow />
        <NotesRow hidden />
      </div>
    </section>
  );
}
