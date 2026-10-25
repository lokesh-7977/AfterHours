import type { Metadata } from "next";
import Image from "next/image";
import { ANIMATION_CREDITS, ANIMATION_LICENSE, LICENSE, PHOTO_CREDITS, VIDEO_CREDITS } from "@/config/photo-credits";
import { LottieSticker } from "@/components/motion/lottie-sticker";
import { FancyTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Photo credits", description: "Sources for the photographs, videos and animations used on AfterHours." };

export default function CreditsPage() {
  return (
    <div className="container-page py-12 md:py-16">
      <FancyTitle>Photo credits</FancyTitle>
      <p className="lede mt-3">
        Photographs on this site come from Unsplash and are used under the{" "}
        <a href={LICENSE.url} className="link" rel="noopener noreferrer license" target="_blank">
          {LICENSE.name}
        </a>
        . Thank you to the photographers who share their work there.
      </p>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PHOTO_CREDITS.map((c) => (
          <li key={c.file} className="overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)]">
            <div className="relative aspect-[16/10] bg-[var(--color-surface)]">
              <Image src={`/images/hyd/${c.file}`} alt="" fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover" />
            </div>
            <p className="p-4 text-sm leading-relaxed">
              <a href={c.source} className="link" rel="noopener noreferrer" target="_blank">
                {c.title}
              </a>
            </p>
          </li>
        ))}
      </ul>

      <h2 className="heading mt-16 !text-[clamp(1.8rem,1.5rem+1.2vw,2.5rem)]">Videos</h2>
      <p className="lede mt-3">Video loops come from Pexels and Mixkit and are used under their free licences.</p>
      <ul className="mt-6 grid gap-2 text-sm sm:grid-cols-2">
        {VIDEO_CREDITS.map((c) => (
          <li key={c.file}>
            <a href={c.source} className="link" rel="noopener noreferrer" target="_blank">
              {c.title}
            </a>{" "}
            <span className="muted">({c.license})</span>
          </li>
        ))}
      </ul>

      <h2 className="heading mt-16 !text-[clamp(1.8rem,1.5rem+1.2vw,2.5rem)]">Animations</h2>
      <p className="lede mt-3">
        Animated stickers come from LottieFiles and are used under the{" "}
        <a href={ANIMATION_LICENSE.url} className="link" rel="noopener noreferrer license" target="_blank">
          {ANIMATION_LICENSE.name}
        </a>
        .
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {ANIMATION_CREDITS.map((c) => (
          <li key={c.file} className="flex flex-col items-center rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-4 text-center text-sm">
            <LottieSticker src={`/lottie/${c.file}`} className="h-24 w-24" />
            <a href={c.source} className="link mt-2" rel="noopener noreferrer" target="_blank">
              {c.title}
            </a>
            <p className="muted">by {c.creator}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
