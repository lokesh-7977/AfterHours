import Image from "next/image";
import { Dices, Disc3, HeartHandshake, Mic2, PartyPopper, Sparkles, type LucideIcon } from "lucide-react";
import { EXPERIENCES, TONE_STYLES } from "@/config/site";
import { HandNote, Hi, Marker, SectionHeader } from "./section-header";
import { LottieSticker } from "@/components/motion/lottie-sticker";

const ICONS: Record<(typeof EXPERIENCES)[number]["icon"], LucideIcon> = {
  party: PartyPopper,
  dice: Dices,
  heart: HeartHandshake,
  music: Disc3,
  dance: Sparkles,
  mic: Mic2,
};

export function EventCategories() {
  return (
    <section id="discover" aria-labelledby="categories-title" className="section">
      <div className="container-page">
        <SectionHeader
          id="categories-title"
          note={<HandNote tone="peacock" className="mb-2 -rotate-2">which one are you?</HandNote>}
          title={
            <>
              What are you in the <Marker tone="pink">mood</Marker> for?
            </>
          }
          lede={
            <>
              Every AfterHours experience in <Hi tone="pink">Hyderabad</Hi> is planned and hosted by the <Hi tone="indigo">AfterHours team</Hi>. Find your{" "}
              <Hi tone="peacock">vibe</Hi>, then sign up to join in.
            </>
          }
        />
        <ul data-stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {EXPERIENCES.map((x) => {
            const Icon = ICONS[x.icon];
            const tone = TONE_STYLES[x.tone];
            return (
              <li key={x.label} className="grid">
                <div className="zoom-parent group relative flex flex-col overflow-hidden rounded-[1.5rem] p-2 transition-transform duration-300 hover:-translate-y-1" style={{ background: tone.soft }}>
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[1.1rem] bg-[var(--color-surface)] md:aspect-[16/10]">
                    <Image src={x.image} alt={x.alt} fill sizes="(min-width: 768px) 30vw, 48vw" className="zoom-img object-cover" />
                    {x.icon === "heart" ? <LottieSticker src="/lottie/love.json" className="absolute -bottom-2 -left-2 h-20 w-20" /> : null}
                    {x.icon === "party" ? <LottieSticker src="/lottie/party-popper.json" className="absolute -bottom-1 -left-1 h-20 w-20" loop={false} still={1} /> : null}
                  </div>
                  <div className="flex items-start gap-3 px-2 pb-2 pt-3 sm:px-3 sm:pb-3 sm:pt-4">
                    <span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full sm:flex" style={{ background: tone.solid, color: tone.onSolid }}>
                      <Icon aria-hidden className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold leading-snug tracking-tight sm:text-lg">{x.label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-[var(--color-ink-soft)] sm:text-sm">{x.blurb}</span>
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
