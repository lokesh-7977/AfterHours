"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger);

/**
 * Entrance for every page (mounted fresh per navigation by each route group's template.tsx):
 * the page rises in, and cards below the fold rise in as they scroll into view. The marketing home runs its own
 * richer sequence (MotionRoot), so it is skipped here.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el || el.querySelector("[data-motion-root]")) return;
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", (ctx) => {
        // Only this component's own wrapper is touched on entry: descendants may still be
        // waiting to hydrate inside Suspense, and inline styles there would cause mismatches.
        gsap.from(el, { opacity: 0, y: 24, duration: 0.7, ease: "power3.out", clearProps: "opacity,transform" });

        // Once hydration has settled, cards further down (event grids, lists) rise in on scroll.
        // ctx.add keeps these tweens/triggers in the GSAP context, so they're reverted on navigation.
        const reveal = () =>
          ctx.add(() => {
            const below = Array.from(el.querySelectorAll<HTMLElement>("article, .card")).filter((c) => c.getBoundingClientRect().top > window.innerHeight);
            if (!below.length) return;
            gsap.set(below, { opacity: 0, y: 30 });
            ScrollTrigger.batch(below, { start: "top 90%", once: true, onEnter: (batch) => gsap.to(batch, { opacity: 1, y: 0, duration: 0.6, stagger: 0.08, ease: "power3.out", clearProps: "transform" }) });
          });
        const timer = window.setTimeout(reveal, 800);
        return () => window.clearTimeout(timer);
      });
    },
    { scope: ref },
  );
  return <div ref={ref}>{children}</div>;
}
