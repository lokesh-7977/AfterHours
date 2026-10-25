import type { ReactNode } from "react";
import { TONE_STYLES, type FestivalTone } from "@/config/site";

/** An italic serif phrase in a festival colour, with a soft swipe beneath it (GSAP grows the swipe in). */
export function Marker({ tone, children }: { tone: FestivalTone; children: ReactNode }) {
  return (
    <span className="marker accent" style={{ color: TONE_STYLES[tone].text }}>
      {children}
      <span aria-hidden className="marker-swipe" style={{ background: `color-mix(in srgb, ${TONE_STYLES[tone].solid} 22%, transparent)` }} />
    </span>
  );
}

/** A keyword in body copy, picked out in its festival colour with a soft underline. */
export function Hi({ tone, children }: { tone: FestivalTone; children: ReactNode }) {
  return (
    <span
      className="font-semibold"
      style={{ color: TONE_STYLES[tone].text, backgroundImage: `linear-gradient(${TONE_STYLES[tone].soft}, ${TONE_STYLES[tone].soft})`, backgroundSize: "100% 0.42em", backgroundPosition: "0 88%", backgroundRepeat: "no-repeat" }}
    >
      {children}
    </span>
  );
}

/** Handwritten aside in a festival colour, used for a few friendly notes. */
export function HandNote({ tone, children, className = "" }: { tone: FestivalTone; children: ReactNode; className?: string }) {
  return (
    <p className={`hand text-xl leading-tight ${className}`} style={{ color: TONE_STYLES[tone].text }}>
      {children}
    </p>
  );
}

/** Heading block used by home sections: lines rise in on scroll; `note` is an optional handwritten aside. */
export function SectionHeader({ id, title, lede, note, action, center = false }: { id?: string; title: ReactNode; lede?: ReactNode; note?: ReactNode; action?: ReactNode; center?: boolean }) {
  return (
    <div className={`mb-8 flex flex-col items-center gap-5 text-center md:mb-14 ${center ? "" : "md:flex-row md:items-end md:justify-between md:text-left"}`}>
      <div className={`flex flex-col items-center ${center ? "" : "md:items-start"}`}>
        {note}
        <h2 id={id} data-split className="heading max-w-3xl">
          {title}
        </h2>
        {lede ? (
          <p data-reveal className="lede mt-4">
            {lede}
          </p>
        ) : null}
      </div>
      {action ? <div data-reveal className="shrink-0">{action}</div> : null}
    </div>
  );
}
