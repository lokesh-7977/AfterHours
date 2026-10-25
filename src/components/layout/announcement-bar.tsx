"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import gsap from "gsap";
import { ArrowRight, X } from "lucide-react";
import { ANNOUNCEMENT_STORAGE_KEY } from "@/config/site";

/**
 * Slim bar above the navbar. Dismissal is remembered per announcement id in localStorage; the
 * root layout's pre-paint script hides a dismissed bar before first paint (no layout shift).
 */
export function AnnouncementBar({ id, message, href }: { id: string; message: string; href: string }) {
  const [open, setOpen] = useState(true);
  const bar = useRef<HTMLDivElement>(null);
  if (!open) return null;
  return (
    <div ref={bar} data-announcement className="relative overflow-hidden bg-[linear-gradient(90deg,var(--color-primary),var(--fest-pink))] text-white">
      <div className="mx-auto flex min-h-10 max-w-[76rem] items-center justify-center px-12 py-2 text-center text-[0.82rem] font-semibold">
        <Link prefetch={false} href={href} className="group inline-flex items-center gap-2 rounded-sm hover:underline hover:underline-offset-4">
          {message}
          <ArrowRight aria-hidden className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex -translate-y-1/2 h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white sm:right-4"
          aria-label="Dismiss announcement"
          onClick={() => {
            try {
              localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, id);
            } catch {
              // storage blocked: the bar just comes back next visit
            }
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            gsap.to(bar.current, { height: 0, autoAlpha: 0, duration: reduce ? 0 : 0.35, ease: "power2.inOut", onComplete: () => setOpen(false) });
          }}
        >
          <X aria-hidden className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
