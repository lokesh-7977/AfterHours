import Image from "next/image";
import { Check } from "lucide-react";
import { TONE_STYLES, type FestivalTone } from "@/config/site";
import { HandNote, Marker } from "./section-header";

const POINTS: [string, FestivalTone][] = [
  ["Experiences curated by AfterHours", "pink"],
  ["One place to discover upcoming events", "peacock"],
  ["Clear event information", "saffron"],
  ["A community-first approach", "indigo"],
];

export function AboutSection() {
  return (
    <section id="about" aria-labelledby="about-title" className="section">
      <div className="container-page grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        <div data-reveal className="relative">
          <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] bg-[var(--color-surface)]">
            <Image src="/images/hyd/three-friends.jpg" alt="Three friends smiling together at an event" fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </div>
          <div className="absolute -bottom-6 -right-6 hidden w-[42%] overflow-hidden rounded-[1.5rem] ring-8 ring-[var(--color-canvas)] sm:block">
            <div className="relative aspect-square">
              <Image src="/images/hyd/dance-joy.jpg" alt="A woman dancing joyfully with her arms raised" fill sizes="20vw" className="object-cover" />
            </div>
          </div>
          <span data-float aria-hidden className="absolute -left-3 -top-3 h-10 w-10 rounded-full bg-[var(--fest-marigold)]" />
        </div>
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <HandNote tone="pink" className="mb-2 -rotate-2">
            our whole idea, really
          </HandNote>
          <h2 id="about-title" data-split className="heading">
            We bring people <Marker tone="peacock">together,</Marker> one experience at a time.
          </h2>
          <p data-reveal className="lede mt-5">
            AfterHours is built around a simple idea: the best experiences happen when people come together. We create and curate events that give people more
            opportunities to connect, explore their interests, learn something new, and make lasting memories.
          </p>
          <ul data-stagger className="mt-8 grid w-full gap-3 text-left sm:grid-cols-2">
            {POINTS.map(([p, tone]) => (
              <li key={p} className="flex items-start gap-3 rounded-2xl p-4 font-semibold leading-snug" style={{ background: TONE_STYLES[tone].soft }}>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full" style={{ background: TONE_STYLES[tone].solid, color: TONE_STYLES[tone].onSolid }}>
                  <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
