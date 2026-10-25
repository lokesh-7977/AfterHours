import Link from "next/link";
import type { ReactNode } from "react";
import { PublicShell } from "@/components/public-shell";

const NAV = [
  ["Dashboard", "/admin/dashboard"],
  ["Events", "/admin/events"],
  ["Registrations", "/admin/registrations"],
  ["Payments", "/admin/payments"],
  ["Attendance", "/admin/attendance"],
  ["Media", "/admin/media"],
  ["Feedback & comments", "/admin/feedback"],
  ["Users", "/admin/users"],
  ["Settings & audit", "/admin/settings"],
] as const;

/** Static chrome only; every page performs its own server-side admin check. */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <PublicShell>
    <div className="container-page grid gap-6 py-8 lg:grid-cols-[200px_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col" aria-label="Admin">
        <p className="muted mb-2 hidden text-xs font-semibold uppercase tracking-wide lg:block">Admin console</p>
        {NAV.map(([label, href]) => (
          <Link key={href} href={href} className="btn btn-ghost btn-sm justify-start">
            {label}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
    </PublicShell>
  );
}
