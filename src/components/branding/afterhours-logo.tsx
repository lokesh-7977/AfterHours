import Link from "next/link";
import { AfterHoursIcon, type AfterHoursIconVariant } from "./afterhours-icon";

/** Horizontal lockup: SVG symbol + live-text wordmark. Links home unless `href` is null. */
export function AfterHoursLogo({
  variant = "brand",
  href = "/",
  className = "",
}: {
  variant?: Exclude<AfterHoursIconVariant, "tile">;
  href?: string | null;
  className?: string;
}) {
  const lockup = (
    <>
      <AfterHoursIcon variant={variant} className="h-[1.6em] w-[1.6em] shrink-0" />
      <span className="wordmark">AfterHours</span>
    </>
  );
  const classes = `inline-flex items-center gap-[0.4em] text-[1.3rem] ${className}`;
  return href === null ? (
    <span className={classes}>{lockup}</span>
  ) : (
    <Link href={href} className={`${classes} rounded-md`} aria-label="AfterHours home">
      {lockup}
    </Link>
  );
}
