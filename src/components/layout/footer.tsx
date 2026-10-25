import Link from "next/link";
import { getContactEmail } from "@/lib/contact";
import { AfterHoursLogo } from "@/components/branding/afterhours-logo";
import { LottieSticker } from "@/components/motion/lottie-sticker";

const LINK_TONES = ["var(--fest-pink-text)", "var(--fest-peacock-text)", "var(--fest-saffron-text)", "var(--accent-text)", "var(--fest-marigold-text)"];

/**
 * Privacy, terms, community guidelines and social profiles are added here once those
 * pages/profiles are published.
 */
export function Footer() {
  const contact = getContactEmail();
  // In-page sections plus the two account pages; the landing page sends people nowhere else.
  const links: [string, string][] = [
    ["Discover", "/#discover"],
    ["How it works", "/#how-it-works"],
    ["About AfterHours", "/#about"],
    ["FAQs", "/#faq"],
    ["Log in", "/login"],
    ["Sign up", "/register"],
    ...(contact ? ([["Contact", `mailto:${contact}`]] as [string, string][]) : []),
  ];
  return (
    <footer className="relative isolate overflow-hidden border-t border-[var(--color-line)] bg-[var(--color-card)]">
      <div aria-hidden className="h-1 bg-[linear-gradient(90deg,var(--fest-saffron),var(--fest-pink),var(--color-primary),var(--fest-peacock),var(--fest-marigold))]" />
      <span aria-hidden className="absolute -left-24 top-10 -z-10 h-64 w-64 rounded-full bg-[var(--fest-pink)] opacity-[0.08] blur-3xl" />
      <span aria-hidden className="absolute -right-24 bottom-0 -z-10 h-72 w-72 rounded-full bg-[var(--color-primary)] opacity-[0.1] blur-3xl" />

      <div className="container-page pb-8 pt-10 md:pt-20">
        <div className="grid gap-8 text-center md:grid-cols-[1.3fr_1fr] md:items-end md:text-left">
          <div className="flex flex-col items-center md:items-start">
            <div className="flex flex-col items-center gap-1 md:flex-row md:items-end md:gap-2">
              <LottieSticker src="/lottie/robot-dance.json" className="h-16 w-16 shrink-0 md:-mb-2" />
              <p className="hand -rotate-2 text-xl text-[var(--fest-saffron-text)]">come for the vibe, stay for the people</p>
            </div>
            <p className="heading mt-2 max-w-xl">
              See you out there, <span className="text-festival accent">Hyderabad.</span>
            </p>
          </div>
          <nav aria-label="Footer" className="justify-self-center md:justify-self-end">
            <ul className="grid grid-cols-2 gap-x-8 gap-y-3 text-left text-[0.95rem] font-medium">
              {links.map(([label, href], i) => {
                const cls = "group inline-flex items-center gap-2 text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]";
                const dot = <span aria-hidden className="h-1.5 w-1.5 rounded-full transition-transform group-hover:scale-150" style={{ background: LINK_TONES[i % LINK_TONES.length] }} />;
                return (
                  <li key={label}>
                    {href.startsWith("mailto:") ? (
                      <a href={href} className={cls}>{dot}{label}</a>
                    ) : (
                      <Link prefetch={false} href={href} className={cls}>{dot}{label}</Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        <div className="mt-10 flex flex-col items-center gap-3 border-t border-[var(--color-line)] pt-8 text-center">
          <AfterHoursLogo />
          <p className="muted text-xs">© 2026 AfterHours. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
