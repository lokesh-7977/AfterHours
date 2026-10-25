import Image from "next/image";
import Link from "next/link";
import { ArrowDownRight, MapPin, Sparkles } from "lucide-react";
import { AfterHoursIcon } from "@/components/branding/afterhours-icon";
import { ConfettiLink } from "@/components/motion/confetti-link";
import { LottieSticker } from "@/components/motion/lottie-sticker";
import { WelcomeConfetti } from "@/components/motion/welcome-confetti";
import { HeroBubbles } from "@/components/motion/hero-bubbles";
import { Hi, Marker } from "./section-header";

const PHOTOS = [
  { src: "/images/hyd/house-party.jpg", alt: "Friends dancing with their hands up at a house party", className: "left-0 top-0 h-[64%] w-[66%] rounded-[1.75rem]", sizes: "(min-width: 1024px) 370px, (min-width: 768px) 60vw, 1px", preload: true },
  { src: "/images/hyd/ludo.jpg", alt: "Game pieces and dice mid-game on a ludo board", className: "right-0 top-[18%] h-[40%] w-[31%] rounded-[1.5rem]", sizes: "(min-width: 1024px) 200px, (min-width: 768px) 30vw, 1px", preload: false },
  { src: "/images/hyd/coffee-date.jpg", alt: "Two people laughing over coffee at an outdoor cafe", className: "bottom-0 left-[8%] h-[33%] w-[54%] rounded-[1.5rem]", sizes: "(min-width: 1024px) 300px, (min-width: 768px) 50vw, 1px", preload: false },
] as const;


/**
 * Three photos packed edge to edge (no dead space), top-aligned with the headline,
 * with the logo's accent dot arriving in the top-right gap.
 */
function Collage() {
  return (
    <div className="relative mx-auto aspect-[10/9] w-full max-w-[34rem]">
      {PHOTOS.map((p) => (
        <div key={p.src} data-hero="photo" className={`absolute overflow-hidden bg-[var(--color-surface)] shadow-[var(--shadow-lift)] ring-4 ring-[var(--color-card)] ${p.className}`}>
          <Image src={p.src} alt={p.alt} fill sizes={p.sizes} preload={p.preload} loading={p.preload ? "eager" : "lazy"} className="object-cover" />
        </div>
      ))}
      <LottieSticker src="/lottie/stars.json" className="absolute -left-5 -top-8 h-20 w-20 sm:h-28 sm:w-28" />
      <span data-hero="dot" className="absolute right-[10%] top-[2%] block aspect-square w-[11%] rounded-full bg-[var(--color-primary)] shadow-[0_10px_30px_-8px_var(--color-primary)]" aria-hidden />
      <div data-hero="note" className="absolute bottom-[4%] right-0 hidden max-w-[38%] items-start gap-1 sm:flex" aria-hidden>
        <svg viewBox="0 0 60 50" className="mt-[-1.6rem] h-10 w-12 shrink-0 text-[var(--fest-pink)]" fill="none">
          <path d="M55 45C40 44 18 38 10 8M10 8 4 18M10 8l9 7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="120" />
        </svg>
        <p className="hand -rotate-3 text-base leading-tight text-[var(--fest-pink-text)] sm:text-lg">house parties, board games &amp; blind dates</p>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
      <WelcomeConfetti />
      <HeroBubbles />
      {/* Mobile: one centred column. Desktop: text and collage share the same top edge. */}
      <div className="container-page relative grid items-start gap-10 pb-10 pt-6 text-center sm:pt-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-12 lg:pb-16 lg:pt-14 lg:text-left">
        <div className="relative flex flex-col items-center lg:items-start">
          <LottieSticker src="/lottie/party-popper.json" className="absolute -top-6 right-6 hidden h-28 w-28 sm:block lg:-right-4" />
          <div data-hero="badge" className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            <p className="inline-flex items-center gap-2 rounded-full border border-[var(--color-line)] bg-[var(--color-card)] py-1.5 pl-1.5 pr-3.5 text-sm font-medium text-[var(--color-ink-soft)]">
              <AfterHoursIcon variant="tile" className="h-6 w-6" />
              Curated experiences. One community.
            </p>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-ink)] px-3 py-1.5 text-sm font-medium text-[var(--color-canvas)]">
              <MapPin aria-hidden className="h-3.5 w-3.5" />
              Hyderabad
            </p>
          </div>
          <h1 id="hero-title" data-hero="title" className="display relative mt-5 max-w-[14ch] lg:mt-6">
            Make room for <Marker tone="pink">experiences</Marker> that <span className="text-festival accent">matter.</span>
          </h1>
          <p data-hero="copy" className="lede mt-5 lg:mt-6">
            <Hi tone="pink">House parties</Hi>, <Hi tone="marigold">board game nights</Hi>, <Hi tone="saffron">blind dates</Hi>, <Hi tone="indigo">DJ sets</Hi> and{" "}
            <Hi tone="peacock">dance floors</Hi> across Hyderabad. Discover experiences worth stepping out for, and find your people with AfterHours.
          </p>
          <div data-hero="ctas" className="mt-7 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center lg:mt-8">
            <ConfettiLink prefetch={false} href="/register" className="btn btn-primary btn-lg">
              <Sparkles aria-hidden className="h-4 w-4" />
              Join AfterHours
            </ConfettiLink>
            <Link prefetch={false} href="/#how-it-works" className="btn btn-lg">
              How AfterHours Works
              <ArrowDownRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>
        </div>
        {/* Photos are a desktop/tablet treat; phones get the text and buttons only. */}
        <div className="hidden w-full md:block lg:pt-2">
          <Collage />
        </div>
      </div>
    </section>
  );
}
