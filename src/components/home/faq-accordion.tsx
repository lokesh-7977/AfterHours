"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { Plus } from "lucide-react";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const INITIAL_OPEN = 0;

/** One question open at a time; GSAP animates the panel height and the plus/cross icon. */
export function FaqAccordion({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(INITIAL_OPEN);
  const root = useRef<HTMLDivElement>(null);
  const baseId = useId();
  // Runs only from click handlers, so plain tweens are fine (nothing to clean up on unmount).
  function animate(next: number | null, prev: number | null) {
    const duration = prefersReducedMotion() ? 0 : 0.4;
    const panel = (i: number) => root.current?.querySelector<HTMLElement>(`[data-panel="${i}"]`);
    const icon = (i: number) => root.current?.querySelector<HTMLElement>(`[data-icon="${i}"]`);
    if (prev !== null) {
      gsap.to(panel(prev) ?? [], { height: 0, autoAlpha: 0, duration, ease: "power2.inOut" });
      gsap.to(icon(prev) ?? [], { rotation: 0, duration });
    }
    if (next !== null) {
      gsap.fromTo(panel(next) ?? [], { height: 0, autoAlpha: 0 }, { height: "auto", autoAlpha: 1, duration, ease: "power2.out" });
      gsap.to(icon(next) ?? [], { rotation: 135, duration });
    }
  }

  return (
    <div ref={root} className="divide-y divide-[var(--color-line)] border-y border-[var(--color-line)]">
      {items.map((item, i) => {
        const isOpen = open === i;
        const buttonId = `${baseId}-q${i}`;
        const panelId = `${baseId}-a${i}`;
        return (
          <div key={item.q}>
            <h3>
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                className="flex min-h-16 w-full items-center justify-between gap-6 py-5 text-left text-[1.1rem] font-bold tracking-tight transition-colors hover:text-[var(--color-accent)]"
                onClick={() => {
                  const next = isOpen ? null : i;
                  const prev = open;
                  setOpen(next);
                  // Measure and animate after the click has painted (keeps INP low).
                  requestAnimationFrame(() => animate(next, prev));
                }}
              >
                {item.q}
                <span
                  data-icon={i}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${isOpen ? "bg-[var(--fest-pink)] text-white" : "border border-[var(--color-line-strong)]"}`}
                  // Initial pose only; afterwards GSAP owns the transform.
                  style={i === INITIAL_OPEN ? { transform: "rotate(135deg)" } : undefined}
                >
                  <Plus aria-hidden className="h-4 w-4" />
                </span>
              </button>
            </h3>
            <div
              id={panelId}
              data-panel={i}
              role="region"
              aria-labelledby={buttonId}
              className="overflow-hidden"
              // Initial state only; afterwards GSAP owns height/visibility (React must not reset them mid-tween).
              style={i === INITIAL_OPEN ? undefined : { height: 0, visibility: "hidden" }}
            >
              <div className="muted max-w-2xl pb-6 pr-12 leading-relaxed">{item.a}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
