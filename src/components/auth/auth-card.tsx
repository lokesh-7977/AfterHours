import Image from "next/image";
import type { ReactNode } from "react";
import { Check, MapPin } from "lucide-react";
import { FancyTitle } from "@/components/ui";
import { HeroBubbles } from "@/components/motion/hero-bubbles";
import { TONE_STYLES, type FestivalTone } from "@/config/site";

type Scene = {
  src: string;
  alt: string;
  note: string;
  tone: FestivalTone;
  chips: [string, FestivalTone][];
  /** Real product features only. */
  perks?: string[];
};

/** Each auth page gets its own photo, note and vibe chips so the flow feels like the landing page. */
const SCENES: Record<"login" | "register" | "reset" | "admin", Scene> = {
  login: {
    src: "/images/hyd/party-cheer.jpg",
    alt: "Friends cheering together at a party",
    note: "the crew missed you",
    tone: "marigold",
    chips: [["House parties", "pink"], ["Board games", "marigold"], ["DJ nights", "indigo"]],
  },
  register: {
    src: "/images/hyd/friends-laughing.jpg",
    alt: "Two friends laughing at a phone outdoors",
    note: "your people are out there",
    tone: "pink",
    chips: [["Blind dates", "saffron"], ["Dance floors", "peacock"], ["Open mics", "pink"]],
    perks: ["Save the events you're into", "Register and get your QR pass", "Unlock private event galleries"],
  },
  reset: {
    src: "/images/hyd/card-night.jpg",
    alt: "Friends playing cards around a table",
    note: "happens to the best of us",
    tone: "peacock",
    chips: [["Board games", "marigold"], ["Chai breaks", "saffron"]],
  },
  admin: {
    src: "/images/hyd/dj-night.jpg",
    alt: "A DJ playing to a crowd under purple lights",
    note: "backstage pass",
    tone: "saffron",
    chips: [["AfterHours team", "indigo"]],
  },
};

function Chips({ chips, onDark = false }: { chips: Scene["chips"]; onDark?: boolean }) {
  return (
    <ul className="flex flex-wrap justify-center gap-2 md:justify-start">
      {chips.map(([label, tone]) => (
        <li
          key={label}
          className="hand rounded-full px-3 py-1 text-base leading-none"
          style={onDark ? { background: TONE_STYLES[tone].solid, color: TONE_STYLES[tone].onSolid } : { background: TONE_STYLES[tone].soft, color: TONE_STYLES[tone].text }}
        >
          {label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Shared frame for log in, sign up, password reset and admin log in: festival bubbles behind,
 * a photo panel with notes on wide screens, and a compact colourful banner on phones.
 */
export function AuthCard({ scene, title, description, children }: { scene: keyof typeof SCENES; title: string; description: ReactNode; children: ReactNode }) {
  const s = SCENES[scene];
  const tone = TONE_STYLES[s.tone];
  return (
    <section className="relative isolate overflow-hidden">
      <HeroBubbles />
      <div className="container-page py-8 md:py-16">
        <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] border border-[var(--color-line)] bg-[var(--color-card)] shadow-[var(--shadow-lift)] md:grid-cols-[1fr_1.05fr]">
          {/* Wide screens: photo panel */}
          <div className="relative hidden min-h-[36rem] md:block">
            <Image src={s.src} alt={s.alt} fill sizes="(min-width: 768px) 45vw, 1px" className="object-cover" preload />
            <div className="absolute inset-0 bg-[linear-gradient(to_top,rgb(10_10_10/0.88),rgb(10_10_10/0.45)_45%,transparent_75%)]" />
            <p className="absolute left-6 top-6 inline-flex items-center gap-1.5 rounded-full bg-[var(--color-card)] px-3 py-1.5 text-sm font-medium text-[var(--color-ink)] shadow-sm">
              <MapPin aria-hidden className="h-3.5 w-3.5 text-[var(--fest-pink-text)]" />
              Hyderabad
            </p>
            <div className="absolute inset-x-8 bottom-8 space-y-4">
              <p className="hand -rotate-2 text-3xl leading-tight" style={{ color: tone.solid }}>
                {s.note}
              </p>
              {s.perks ? (
                <ul className="space-y-2 text-sm font-medium text-white/90">
                  {s.perks.map((p) => (
                    <li key={p} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ background: tone.solid, color: tone.onSolid }}>
                        <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
              ) : null}
              <Chips chips={s.chips} onDark />
            </div>
          </div>

          {/* Phones: compact festival banner instead of the photo */}
          <div className="relative overflow-hidden bg-[linear-gradient(120deg,var(--color-primary),var(--fest-pink)_55%,var(--fest-saffron))] px-6 py-6 text-center md:hidden">
            <p className="hand -rotate-2 text-2xl leading-tight text-white">{s.note}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-white/85">
              <MapPin aria-hidden className="h-3 w-3" /> Hyderabad
            </p>
          </div>

          <div className="flex flex-col p-6 text-center sm:p-10 md:text-left">
            <FancyTitle className="!text-[clamp(2.2rem,1.8rem+1.6vw,3.2rem)]">{title}</FancyTitle>
            <p className="muted mb-7 mt-3 md:max-w-sm">{description}</p>
            <div className="text-left">{children}</div>
            <div className="mt-8 md:hidden">
              <Chips chips={s.chips} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
