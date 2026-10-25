"use client";

import type { Options } from "canvas-confetti";

/** Festival palette (marigold, rani pink, peacock, saffron, indigo) for every burst. */
const COLORS = ["#ffb627", "#e5197a", "#00897b", "#ff6b1a", "#4d39e9", "#ffffff"];

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** canvas-confetti is only fetched the first time something celebrates. */
async function fire(opts: Options) {
  if (reducedMotion()) return;
  const { default: confetti } = await import("canvas-confetti");
  await confetti({ colors: COLORS, disableForReducedMotion: true, zIndex: 60, ...opts });
}

/** Viewport-relative origin (0..1) for the centre of an element. */
function originOf(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight };
}

/** A quick pop from an element: buttons, toggles. */
export function popFrom(el: Element, size: "sm" | "md" = "md") {
  void fire({ particleCount: size === "sm" ? 40 : 90, spread: size === "sm" ? 60 : 80, startVelocity: size === "sm" ? 28 : 38, scalar: 0.9, origin: originOf(el) });
}

/** Two side cannons: the big celebration (welcome, confirmed registrations). */
export function celebrate() {
  void fire({ particleCount: 70, angle: 60, spread: 70, origin: { x: 0, y: 0.75 } });
  void fire({ particleCount: 70, angle: 120, spread: 70, origin: { x: 1, y: 0.75 } });
  window.setTimeout(() => void fire({ particleCount: 60, spread: 120, startVelocity: 25, ticks: 220, origin: { x: 0.5, y: 0.35 }, shapes: ["circle", "square"] }), 250);
}
