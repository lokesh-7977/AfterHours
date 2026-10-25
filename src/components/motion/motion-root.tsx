"use client";

import { useRef, type ReactNode } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(useGSAP, ScrollTrigger, SplitText);

/**
 * Drives every entrance and scroll animation on the marketing page from data attributes,
 * so sections stay server components:
 *
 * - `data-hero="badge|ctas|dot|note"`: the load sequence (hidden pre-paint via html.motion);
 *   `title|copy|photo` stay visible from first paint (LCP)
 * - `data-split`: heading lines fade and rise when scrolled into view
 * - `data-reveal`: fade and rise on enter; `data-stagger`: children do so one after another
 * - `data-float`: slow ambient drift; `data-parallax="-12"`: yPercent travel while scrolling
 * - `data-marquee="seconds"` (+ `data-marquee-dir="right"`): infinite loop of a duplicated track
 * - `data-draw`: a line that grows with scroll progress through its parent
 * - `.marker-swipe`: highlight swipes (the `.text-festival` gradient pan is a CSS animation)
 *
 * With prefers-reduced-motion everything is simply shown.
 */
export function MotionRoot({ children }: { children: ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const q = gsap.utils.selector(scope);
      const mm = gsap.matchMedia();

      mm.add("(prefers-reduced-motion: reduce)", () => {
        gsap.set(q("[data-hero]"), { autoAlpha: 1 });
      });

      mm.add("(prefers-reduced-motion: no-preference)", () => {
        // Hero load sequence
        gsap.set(q("[data-hero]"), { autoAlpha: 1 });
        const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
        tl.from(q('[data-hero="badge"]'), { y: 16, autoAlpha: 0, duration: 0.5 });
        // The headline, copy and photos are LCP candidates: they are never hidden or faded, so the
        // page paints its largest content immediately. Motion here only adds the accents around them.
        tl.from(q("[data-hero] .marker-swipe"), { scaleX: 0, duration: 0.7, stagger: 0.15, ease: "power2.inOut" }, 0.1)
          .from(q('[data-hero="ctas"]'), { y: 16, autoAlpha: 0, duration: 0.5 }, "-=0.4")
          .from(q('[data-hero="dot"]'), { x: 90, y: -70, scale: 0, duration: 0.9, ease: "back.out(2)" }, "-=0.3")
          .from(q('[data-hero="note"]'), { autoAlpha: 0, y: 10, rotation: -4, duration: 0.5 }, "-=0.4")
          .from(q('[data-hero="note"] path'), { strokeDashoffset: 120, duration: 0.7, ease: "power1.inOut" }, "<");

        // Ambient
        q("[data-float]").forEach((el, i) => {
          gsap.to(el, { y: gsap.utils.random(-16, 16), x: gsap.utils.random(-10, 10), rotation: gsap.utils.random(-12, 12), duration: gsap.utils.random(3, 5.5), repeat: -1, yoyo: true, ease: "sine.inOut", delay: i * 0.2 });
        });
        q("[data-marquee]").forEach((track) => {
          const duration = Number(track.dataset.marquee) || 40;
          const loop =
            track.dataset.marqueeDir === "right"
              ? gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration, repeat: -1, ease: "none" })
              : gsap.to(track, { xPercent: -50, duration, repeat: -1, ease: "none" });
          // Only run while visible, so offscreen loops never compete with taps (INP).
          ScrollTrigger.create({ trigger: track, start: "top bottom", end: "bottom top", onToggle: (self) => (self.isActive ? loop.play() : loop.pause()) });
        });

        // Scroll-driven
        q("[data-split]").forEach((heading) => {
          SplitText.create(heading, {
            type: "lines",
            autoSplit: true,
            onSplit: (self) => {
              return gsap.from(self.lines, { yPercent: 40, opacity: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", scrollTrigger: { trigger: heading, start: "top 92%", once: true } });
            },
          });
        });
        q("[data-split] .marker-swipe, [data-reveal] .marker-swipe").forEach((m) => {
          gsap.from(m, { scaleX: 0, duration: 0.7, delay: 0.35, ease: "power2.inOut", scrollTrigger: { trigger: m, start: "top 88%", once: true } });
        });
        gsap.set(q("[data-reveal]"), { autoAlpha: 0, y: 36 });
        ScrollTrigger.batch(q("[data-reveal]"), {
          start: "top 92%",
          once: true,
          onEnter: (batch) => gsap.to(batch, { autoAlpha: 1, y: 0, duration: 0.8, stagger: 0.1, ease: "power3.out", overwrite: true }),
        });
        q("[data-stagger]").forEach((group) => {
          gsap.from(group.children, { autoAlpha: 0, y: 40, scale: 0.97, duration: 0.7, stagger: 0.09, ease: "power3.out", scrollTrigger: { trigger: group, start: "top 85%", once: true } });
        });
        q("[data-parallax]").forEach((el) => {
          gsap.fromTo(el, { yPercent: -Number(el.dataset.parallax) }, { yPercent: Number(el.dataset.parallax), ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
        });
        q("[data-draw]").forEach((line) => {
          gsap.from(line, { scaleY: 0, transformOrigin: "top center", ease: "none", scrollTrigger: { trigger: line.parentElement, start: "top 70%", end: "bottom 70%", scrub: true } });
        });
        // Images, web fonts and line splits change the page height after these triggers are
        // measured; re-measure once they settle so nothing below stays hidden.
        const refresh = () => ScrollTrigger.refresh();
        window.addEventListener("load", refresh);
        document.fonts?.ready.then(refresh);
        const late = window.setTimeout(refresh, 1500);

        q("[data-step]").forEach((step) => {
          gsap.from(step.querySelectorAll("[data-step-part]"), { autoAlpha: 0, y: 30, duration: 0.7, stagger: 0.12, ease: "power3.out", scrollTrigger: { trigger: step, start: "top 80%", once: true } });
          const node = step.querySelector("[data-step-node]");
          if (node) gsap.from(node, { scale: 0, duration: 0.6, ease: "back.out(2.5)", scrollTrigger: { trigger: step, start: "top 75%", once: true } });
        });

        // Safety net: anything already scrolled past (fast flicks, jump links) is shown at once.
        const sweep = ScrollTrigger.create({
          start: 0,
          end: "max",
          onUpdate: () => {
            q("[data-reveal], [data-stagger] > *").forEach((el) => {
              if (Number(gsap.getProperty(el, "opacity")) < 1 && el.getBoundingClientRect().bottom < 0) gsap.set(el, { autoAlpha: 1, y: 0, scale: 1 });
            });
          },
        });

        return () => {
          window.removeEventListener("load", refresh);
          window.clearTimeout(late);
          sweep.kill();
        };
      });
    },
    { scope },
  );

  return (
    <div ref={scope} data-motion-root>
      {children}
    </div>
  );
}
