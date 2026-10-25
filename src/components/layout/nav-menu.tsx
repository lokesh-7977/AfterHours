"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { MAIN_NAV } from "@/config/site";
import { AfterHoursIcon } from "@/components/branding/afterhours-icon";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

export type NavAccount =
  | { kind: "guest" }
  | { kind: "participant"; firstName: string; unread: number }
  | { kind: "admin" };

const PARTICIPANT_LINKS = [
  ["Dashboard", "/dashboard"],
  ["My events", "/my-events"],
  ["My passes", "/my-passes"],
  ["Galleries", "/my-gallery"],
  ["Profile", "/profile"],
] as const;

/** Tracks which home-page section (#discover, #about, #faq) is in view, for the active nav state. */
function useActiveSection(enabled: boolean) {
  const [active, setActive] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    const ids = MAIN_NAV.flatMap((i) => (i.href.startsWith("/#") ? [i.href.slice(2)] : []));
    const els = ids.map((id) => document.getElementById(id)).filter((el): el is HTMLElement => el !== null);
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(e.target.id);
          else setActive((cur) => (cur === e.target.id ? null : cur));
        }
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [enabled]);
  return enabled ? active : null;
}

function useIsActive() {
  const pathname = usePathname();
  const section = useActiveSection(pathname === "/");
  return (href: string) =>
    href.startsWith("/#") ? pathname === "/" && section === href.slice(2) : pathname === href;
}

export function DesktopNav() {
  const isActive = useIsActive();
  return (
    <nav aria-label="Main" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {MAIN_NAV.map((item) => {
          const active = isActive(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
                  active ? "bg-[var(--color-card)] text-[var(--color-ink)] shadow-[0_0_0_1px_var(--color-line)]" : "text-[var(--color-muted)] hover:text-[var(--color-ink)]"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function AccountActions({ account }: { account: NavAccount }) {
  return (
    <div className="hidden items-center gap-2 md:flex">
      <ThemeToggle />
      {account.kind === "guest" ? (
        <Link prefetch={false} href="/login" className="btn btn-ghost">Log in</Link>
      ) : account.kind === "admin" ? (
        <Link prefetch={false} href="/admin/dashboard" className="btn btn-ghost">Admin console</Link>
      ) : (
        <Link prefetch={false} href="/dashboard" className="btn btn-ghost gap-2 pl-1.5">
          <AfterHoursIcon variant="tile" className="h-7 w-7" />
          {account.firstName}
          {account.unread ? (
            <span className="badge bg-[var(--color-primary)] text-[var(--color-on-primary)]">
              {account.unread}
              <span className="sr-only"> unread notifications</span>
            </span>
          ) : null}
        </Link>
      )}
      {account.kind !== "guest" ? <SignOutButton redirectTo={account.kind === "admin" ? "/admin/login" : "/"} /> : <Link prefetch={false} href="/register" className="btn btn-primary">Sign up</Link>}
    </div>
  );
}

export function MobileMenu({ account }: { account: NavAccount }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = useIsActive();
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close whenever the route changes (a link was followed).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Drawer entrance: panel drops in, then its links cascade.
  useGSAP(
    () => {
      const panel = panelRef.current;
      if (!open || !panel) return;
      // The panel mounts transparent (see its style) and is revealed on the next frame, so the tap
      // paints immediately (good INP) and focus/animation work happens after that paint.
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const frame = requestAnimationFrame(() => {
        panel.querySelector<HTMLElement>("a, button")?.focus(); // opacity only: visibility:hidden would blur it
        if (reduce) {
          gsap.set(panel, { opacity: 1 });
          return;
        }
        gsap.fromTo(panel, { opacity: 0, y: -12 }, { opacity: 1, y: 0, duration: 0.3, ease: "power2.out" });
        gsap.from(panel.querySelectorAll("li, .btn"), { opacity: 0, y: -10, duration: 0.3, stagger: 0.035, delay: 0.05, ease: "power2.out" });
      });
      return () => cancelAnimationFrame(frame);
    },
    { dependencies: [open] },
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const linkClass = (active: boolean) =>
    `flex min-h-12 items-center rounded-xl px-3 text-base font-semibold ${active ? "bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : "hover:bg-[var(--color-subtle)]"}`;

  return (
    <div className="md:hidden">
      <button
        ref={toggleRef}
        type="button"
        className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-line-strong)] bg-[var(--color-card)]"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <X aria-hidden className="h-5 w-5" /> : <Menu aria-hidden className="h-5 w-5" />}
      </button>
      {open ? (
        <div id={panelId} ref={panelRef} style={{ opacity: 0 }} className="absolute inset-x-0 top-full border-b border-[var(--color-line)] bg-[var(--color-canvas)] shadow-[var(--shadow-lift)]">
          <nav aria-label="Main" className="container-page max-h-[calc(100dvh-5rem)] overflow-y-auto py-4">
            <ul className="space-y-1">
              {MAIN_NAV.map((item) => (
                <li key={item.href}>
                  <Link prefetch={false} href={item.href} className={linkClass(isActive(item.href))} aria-current={isActive(item.href) ? "page" : undefined} onClick={() => setOpen(false)}>
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {account.kind === "participant" ? (
              <ul className="mt-3 space-y-1 border-t border-[var(--color-line)] pt-3">
                {PARTICIPANT_LINKS.map(([label, href]) => (
                  <li key={href}>
                    <Link prefetch={false} href={href} className={linkClass(pathname === href)} onClick={() => setOpen(false)}>
                      {label}
                      {href === "/dashboard" && account.unread ? <span className="badge ml-2 bg-[var(--color-primary)] text-[var(--color-on-primary)]">{account.unread}</span> : null}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 grid gap-2 border-t border-[var(--color-line)] pt-4">
              {account.kind === "guest" ? (
                <>
                  <Link prefetch={false} href="/register" className="btn btn-primary btn-lg w-full">Sign up</Link>
                  <Link prefetch={false} href="/login" className="btn btn-lg w-full">Log in</Link>
                </>
              ) : account.kind === "admin" ? (
                <Link prefetch={false} href="/admin/dashboard" className="btn btn-lg w-full">Admin console</Link>
              ) : null}
              <div className="flex items-center justify-between pt-1">
                <ThemeToggle />
                {account.kind !== "guest" ? <SignOutButton redirectTo={account.kind === "admin" ? "/admin/login" : "/"} /> : null}
              </div>
            </div>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
