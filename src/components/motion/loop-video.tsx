"use client";

import { useEffect, useRef } from "react";

/**
 * A silent looping clip that only downloads and plays while on screen (poster until then),
 * pauses when scrolled away, and stays on its poster frame with reduced motion.
 */
export function LoopVideo({ src, poster, label, className = "" }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!video.src) video.src = src;
          void video.play().catch(() => {}); // autoplay can be refused (e.g. data saver): the poster stays
        } else video.pause();
      },
      { rootMargin: "120px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  return <video ref={ref} poster={poster} muted loop playsInline preload="none" aria-label={label} className={className} />;
}
