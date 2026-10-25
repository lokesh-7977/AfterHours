import type { SVGProps } from "react";

/**
 * The AfterHours symbol: a crescent moon (the night) with one bright star beside it
 * (your plans for it). Simple enough to read at 16px.
 *
 * - `brand`: moon in currentColor, star in the accent colour.
 * - `mono`: everything in currentColor, for single-colour use on any background.
 * - `tile`: white symbol on an accent square, for avatars and app icons.
 */
export type AfterHoursIconVariant = "brand" | "mono" | "tile";

// 32×32 grid. Crescent = circle (16,16) r12 minus circle (21,11) r10; star sits in the bite.
const MOON = "M13.64 4.24A12 12 0 1 0 27.77 18.37A10 10 0 0 1 13.64 4.24Z";
const STAR = "M24.5 3.5l1.15 2.85 2.85 1.15-2.85 1.15-1.15 2.85-1.15-2.85-2.85-1.15 2.85-1.15z";

export function AfterHoursIcon({ variant = "brand", title, ...props }: SVGProps<SVGSVGElement> & { variant?: AfterHoursIconVariant; title?: string }) {
  const labelled = Boolean(title);
  const a11y = { role: labelled ? "img" : undefined, "aria-hidden": labelled ? undefined : true } as const;
  if (variant === "tile") {
    return (
      <svg viewBox="0 0 32 32" {...a11y} {...props}>
        {title ? <title>{title}</title> : null}
        <rect width="32" height="32" rx="8" fill="var(--color-primary, #4d39e9)" />
        <g transform="translate(4.8 4.8) scale(0.7)">
          <path d={MOON} fill="#fff" />
          <path d={STAR} fill="#fff" />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" {...a11y} {...props}>
      {title ? <title>{title}</title> : null}
      <path d={MOON} fill="currentColor" />
      <path d={STAR} fill={variant === "brand" ? "var(--color-primary, #4d39e9)" : "currentColor"} />
    </svg>
  );
}
