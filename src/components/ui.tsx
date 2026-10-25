import Link from "next/link";
import type { ReactNode } from "react";

/** Server-safe presentational primitives. */

/**
 * Serif page title whose last word is an italic festival-gradient accent
 * (PageTransition animates the gradient). Pass plain text.
 */
export function FancyTitle({ children, as: Tag = "h1", className = "" }: { children: string; as?: "h1" | "h2"; className?: string }) {
  const words = children.trim().split(/\s+/);
  const last = words.pop() ?? "";
  return (
    <Tag className={`heading ${className}`}>
      {words.length ? `${words.join(" ")} ` : null}
      <span className="text-festival accent">{last}</span>
    </Tag>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <FancyTitle className="!text-[clamp(2rem,1.6rem+1.6vw,3rem)]">{title}</FancyTitle>
        {description ? <p className="muted mt-2 text-[0.95rem]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>;
}

/** Foreground/background pairs from the design palette. */
const TONES = {
  green: { fg: "var(--color-success)", bg: "var(--color-success-bg)" },
  amber: { fg: "var(--color-warning)", bg: "var(--color-warning-bg)" },
  red: { fg: "var(--color-danger)", bg: "var(--color-danger-bg)" },
  blue: { fg: "var(--color-info)", bg: "var(--color-info-bg)" },
  gray: { fg: "var(--color-muted)", bg: "var(--color-surface)" },
} as const;
export type Tone = keyof typeof TONES;

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="badge" style={{ color: TONES[tone].fg, background: TONES[tone].bg }}>
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, Tone> = {
  draft: "gray",
  published: "green",
  cancelled: "red",
  completed: "blue",
  registered: "green",
  refunded: "amber",
  pending: "amber",
  submitted: "blue",
  approved: "green",
  rejected: "red",
  active: "green",
  revoked: "red",
  verified: "green",
  pending_confirmation: "amber",
  processing: "blue",
  ready: "green",
  failed: "red",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Payment pending",
  submitted: "Awaiting verification",
  pending_confirmation: "Awaiting staff confirmation",
};

export function StatusBadge({ status, plain }: { status: string; plain?: boolean }) {
  const label = plain ? status.replace(/_/g, " ") : (STATUS_LABELS[status] ?? status.replace(/_/g, " "));
  return <Badge tone={STATUS_TONES[status] ?? "gray"}>{label}</Badge>;
}

export function Stat({ label, value, hint, href }: { label: string; value: ReactNode; hint?: ReactNode; href?: string }) {
  const body = (
    <div className="card h-full">
      <div className="muted text-xs uppercase tracking-wide">{label}</div>
      <div className="mt-1 font-mono text-2xl font-bold">{value}</div>
      {hint ? <div className="muted mt-1 text-xs">{hint}</div> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card text-center">
      <p className="font-semibold">{title}</p>
      {children ? <div className="muted mt-2 text-sm">{children}</div> : null}
    </div>
  );
}

export function Alert({ tone = "blue", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className="rounded-lg border px-4 py-3 text-sm" style={{ borderColor: TONES[tone].bg, color: TONES[tone].fg, background: TONES[tone].bg }}>
      {children}
    </div>
  );
}

/** Query-string pagination that preserves other filters. */
export function Pagination({ page, totalPages, basePath, params }: { page: number; totalPages: number; basePath: string; params: Record<string, string | undefined> }) {
  if (totalPages <= 1) return null;
  const href = (p: number) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    qs.set("page", String(p));
    return `${basePath}?${qs.toString()}`;
  };
  return (
    <nav className="mt-6 flex items-center justify-center gap-3 text-sm" aria-label="Pagination">
      {page > 1 ? (
        <Link className="btn btn-sm" href={href(page - 1)}>
          ← Previous
        </Link>
      ) : null}
      <span className="muted">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link className="btn btn-sm" href={href(page + 1)}>
          Next →
        </Link>
      ) : null}
    </nav>
  );
}

export function PageSkeleton() {
  return (
    <div className="container-page py-10" aria-busy="true">
      <div className="h-7 w-48 animate-pulse rounded bg-[var(--color-surface)]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-[var(--color-subtle)]" />
        ))}
      </div>
    </div>
  );
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(iso));
}

/** Read a string search param from Next's searchParams record. */
export function sp(params: Record<string, string | string[] | undefined>, key: string): string | undefined {
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

export function spObject(params: Record<string, string | string[] | undefined>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val !== undefined) out[k] = val;
  }
  return out;
}
