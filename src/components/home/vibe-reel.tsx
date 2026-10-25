import { Music2, PartyPopper, Sparkles, type LucideIcon } from "lucide-react";
import { LoopVideo } from "@/components/motion/loop-video";
import { TONE_STYLES, type FestivalTone } from "@/config/site";
import { Hi, Marker, SectionHeader } from "./section-header";

/** Short silent loops (Pexels / Mixkit, free licences). They show moods, not specific AfterHours events. */
const CLIPS: { src: string; label: string; caption: string; tone: FestivalTone; icon: LucideIcon }[] = [
  { src: "wedding-dance", label: "Guests dancing at a traditional Indian celebration", caption: "Dance floors", tone: "pink", icon: Sparkles },
  { src: "holi-jaipur", label: "A crowd dancing in Holi colours outside a palace", caption: "Holi bashes", tone: "marigold", icon: PartyPopper },
  { src: "people-dancing", label: "Friends dancing together at a party", caption: "House parties", tone: "saffron", icon: PartyPopper },
  { src: "dj-turntable", label: "A DJ mixing on decks under club lights", caption: "DJ nights", tone: "indigo", icon: Music2 },
  { src: "friends-dancing", label: "A woman dancing under neon lights", caption: "Late-night sets", tone: "peacock", icon: Sparkles },
  { src: "festival-music", label: "Drummers playing at a festival", caption: "Live music", tone: "pink", icon: Music2 },
];

export function VibeReel() {
  return (
    <section aria-labelledby="reel-title" className="section">
      <div className="container-page">
        <SectionHeader
          id="reel-title"
          center
          title={
            <>
              Feel the <Marker tone="indigo">vibe.</Marker>
            </>
          }
          lede={
            <>
              <Hi tone="pink">Dance floors</Hi>, <Hi tone="marigold">colour</Hi> and <Hi tone="indigo">music</Hi>: a taste of the energy AfterHours experiences are about.
            </>
          }
        />
        <ul data-stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
          {CLIPS.map(({ src, label, caption, tone, icon: Icon }) => (
            <li key={src} className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] bg-[var(--color-surface)]">
              <LoopVideo src={`/videos/${src}.mp4`} poster={`/videos/${src}.jpg`} label={label} className="h-full w-full object-cover" />
              <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(to_top,rgb(0_0_0/0.55),transparent)]" />
              <span className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[var(--color-card)] px-4 py-1.5 shadow-md">
                <Icon aria-hidden className="h-4 w-4" style={{ color: TONE_STYLES[tone].solid }} />
                <span className="hand text-lg leading-none" style={{ color: TONE_STYLES[tone].text }}>
                  {caption}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
