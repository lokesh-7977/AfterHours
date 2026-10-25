"use client";

import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP);

const COLORS = ["#ffb627", "#e5197a", "#00897b", "#ff6b1a", "#4d39e9", "#ff5fa8", "#4fd1bf"];

/**
 * Glossy festival-coloured bubbles that keep drifting up through the hero, swaying as they go.
 * Sizes and positions are fixed (deterministic) so server and client markup match; GSAP adds
 * the endless motion after hydration. With reduced motion they simply sit still.
 */
const BUBBLES = Array.from({ length: 18 }, (_, i) => ({
  size: [18, 42, 26, 64, 14, 36, 88, 22, 48, 30, 16, 56, 40, 20, 72, 28, 34, 12][i],
  left: (i * 37 + 7) % 100,
  top: (i * 53 + 11) % 100,
  color: COLORS[i % COLORS.length],
}));

export function HeroBubbles() {
  const root = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      gsap.matchMedia().add("(prefers-reduced-motion: no-preference)", () => {
        const el = root.current;
        if (!el) return;
        const height = el.offsetHeight || 800;
        const tweens: gsap.core.Tween[] = [];
        gsap.utils.toArray<HTMLElement>("[data-bubble]", el).forEach((b, i) => {
          const rise = gsap.utils.random(14, 26);
          // Rise from below the hero to above it, forever, starting part-way through so the hero is never empty.
          tweens.push(gsap.fromTo(b, { y: height * 0.6 }, { y: -height * 1.1, duration: rise, ease: "none", repeat: -1, delay: -gsap.utils.random(0, rise) }));
          tweens.push(gsap.to(b, { x: gsap.utils.random(-40, 40), duration: gsap.utils.random(2.5, 4.5), ease: "sine.inOut", repeat: -1, yoyo: true, delay: i * 0.13 }));
          tweens.push(gsap.to(b, { scale: gsap.utils.random(0.85, 1.15), duration: gsap.utils.random(1.8, 3), ease: "sine.inOut", repeat: -1, yoyo: true }));
        });
        // Pause while the hero is scrolled away, so the bubbles never compete with taps elsewhere.
        const observer = new IntersectionObserver(([entry]) => tweens.forEach((t) => (entry.isIntersecting ? t.play() : t.pause())));
        observer.observe(el);
        return () => observer.disconnect();
      });
    },
    { scope: root },
  );

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      {BUBBLES.map((b, i) => (
        <span
          key={i}
          data-bubble
          className="absolute rounded-full"
          style={{
            width: b.size,
            height: b.size,
            left: `${b.left}%`,
            top: `${b.top}%`,
            opacity: b.size > 50 ? 0.18 : 0.42,
            background: `radial-gradient(circle at 32% 30%, rgb(255 255 255 / 0.85), ${b.color} 38%, color-mix(in srgb, ${b.color} 70%, black) 100%)`,
            boxShadow: `0 8px 24px -10px ${b.color}`,
          }}
        />
      ))}
    </div>
  );
}
