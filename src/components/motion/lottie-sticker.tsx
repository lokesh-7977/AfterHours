"use client";

import { useEffect, useRef } from "react";

/**
 * A decorative vector animation (LottieFiles, Lottie Simple License; see /credits).
 * The player and the JSON load only when the sticker scrolls near the viewport, it pauses
 * off-screen, and with reduced motion it shows a single still frame.
 */
export function LottieSticker({ src, className = "", loop = true, still = 0.6 }: { src: string; className?: string; loop?: boolean; /** Progress (0..1) shown when motion is reduced. */ still?: number }) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let anim: { play(): void; pause(): void; destroy(): void; goToAndStop(v: number, isFrame?: boolean): void; totalFrames: number } | null = null;
    let cancelled = false;
    let visible = false;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const observer = new IntersectionObserver(
      async ([entry]) => {
        visible = entry.isIntersecting;
        if (anim) {
          if (visible && !reduce) anim.play();
          else anim.pause();
          return;
        }
        if (!visible) return;
        const [{ default: lottie }, data] = await Promise.all([import("lottie-web/build/player/lottie_light"), fetch(src).then((r) => r.json())]);
        if (cancelled) return;
        anim = lottie.loadAnimation({ container: el, renderer: "svg", loop, autoplay: !reduce, animationData: data });
        if (reduce) anim.goToAndStop(Math.round(anim.totalFrames * still), true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
      anim?.destroy();
    };
  }, [src, loop, still]);

  return <div ref={host} aria-hidden className={`pointer-events-none ${className}`} />;
}
