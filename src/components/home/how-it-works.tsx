import type { ReactNode } from "react";
import { BadgeCheck, BookmarkCheck, CalendarDays, Camera, Clock, Info, Lock, MapPin, ScanLine, Search, Ticket, type LucideIcon } from "lucide-react";
import { TONE_STYLES, type FestivalTone } from "@/config/site";
import { Hi, Marker, SectionHeader } from "./section-header";
import { LottieSticker } from "@/components/motion/lottie-sticker";

/*
 * What actually happens on AfterHours, in order. The small UI vignettes are illustrations
 * of the product (marked "Example"), not real events.
 */

function Vignette({ children, tone }: { children: ReactNode; tone: FestivalTone }) {
  return (
    <div data-step-part aria-hidden className="relative rounded-[1.5rem] p-3" style={{ background: TONE_STYLES[tone].soft }}>
      <div className="rounded-[1.1rem] border border-[var(--color-line)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-lift)]">{children}</div>
      <span className="hand absolute -top-3 right-4 rotate-3 rounded-full bg-[var(--color-card)] px-2.5 text-sm shadow-sm" style={{ color: TONE_STYLES[tone].solid }}>
        example
      </span>
    </div>
  );
}

function Chip({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${active ? "bg-[var(--color-ink)] text-[var(--color-canvas)]" : "border border-[var(--color-line-strong)] text-[var(--color-ink-soft)]"}`}>{children}</span>
  );
}

/** A static QR-like pattern for the pass illustration (not a scannable code). */
function QrArt() {
  const n = 17;
  const finder = (x: number, y: number) => (x < 5 && y < 5) || (x >= n - 5 && y < 5) || (x < 5 && y >= n - 5);
  const cells: [number, number][] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!finder(x, y) && (x * 7 + y * 13 + x * y) % 3 === 0) cells.push([x, y]);
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="h-24 w-24 text-[var(--color-ink)]">
      {[
        [0, 0],
        [n - 5, 0],
        [0, n - 5],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <rect x={x + 0.5} y={y + 0.5} width="4" height="4" fill="none" stroke="currentColor" />
          <rect x={x + 1.5} y={y + 1.5} width="2" height="2" fill="currentColor" />
        </g>
      ))}
      {cells.map(([x, y]) => (
        <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill="currentColor" />
      ))}
    </svg>
  );
}

const STEPS: { title: string; body: string; icon: LucideIcon; tone: FestivalTone; art: ReactNode }[] = [
  {
    title: "Discover",
    body: "Browse upcoming events and explore what interests you, by category, city or date.",
    icon: Search,
    tone: "saffron",
    art: (
      <>
        <div className="flex items-center gap-2 rounded-full border border-[var(--color-line-strong)] px-3 py-2 text-sm text-[var(--color-faint)]">
          <Search className="h-4 w-4" /> Search events
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip active>Board games</Chip>
          <Chip>Hyderabad</Chip>
          <Chip>Friday night</Chip>
        </div>
      </>
    ),
  },
  {
    title: "Explore the details",
    body: "Open an event to check the venue, schedule, entry fee and instructions before you decide.",
    icon: CalendarDays,
    tone: "peacock",
    art: (
      <div className="space-y-2 text-sm">
        <p className="text-lg font-bold">Board game night</p>
        <p className="flex items-center gap-2 text-[var(--color-ink-soft)]"><CalendarDays className="h-4 w-4" /> Saturday <Clock className="ml-2 h-4 w-4" /> 7:00 pm</p>
        <p className="flex items-center gap-2 text-[var(--color-ink-soft)]"><MapPin className="h-4 w-4" /> A café in Jubilee Hills</p>
      </div>
    ),
  },
  {
    title: "Express interest",
    body: "Sign in and mark the events you'd like to attend. It keeps them in your account. It's a bookmark, not a ticket.",
    icon: BookmarkCheck,
    tone: "pink",
    art: (
      <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:gap-3 sm:text-left">
        <span className="whitespace-nowrap text-sm font-bold">Blind date: coffee edition</span>
        <LottieSticker src="/lottie/love.json" className="-my-4 hidden h-16 w-16 shrink-0 sm:block" />
        <span className="btn btn-sm border-[var(--fest-pink)] bg-[var(--fest-pink-soft)] text-[var(--fest-pink)]">
          <BookmarkCheck className="h-4 w-4" /> Interested
        </span>
      </div>
    ),
  },
  {
    title: "Register, and pay if needed",
    body: "When an event takes registrations, reserve your spot from its page. For paid events, follow the payment instructions and the AfterHours team verifies your payment.",
    icon: BadgeCheck,
    tone: "marigold",
    art: (
      <div className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between"><span className="font-bold">Payment</span><span className="badge bg-[var(--fest-marigold-soft)] text-[#7a5200]">Awaiting verification</span></div>
        <div className="flex items-center justify-between"><span className="font-bold">Registration</span><span className="badge bg-[var(--color-success-bg)] text-[var(--color-success)]">Approved</span></div>
      </div>
    ),
  },
  {
    title: "Get your QR pass",
    body: "Once you're confirmed, your entry pass appears in your account, ready to show at the door.",
    icon: Ticket,
    tone: "indigo",
    art: (
      <div className="flex items-center gap-4">
        <QrArt />
        <div className="text-sm">
          <p className="text-lg font-bold leading-tight">Your entry pass</p>
          <p className="muted mt-1">Show this at check-in</p>
        </div>
      </div>
    ),
  },
  {
    title: "Check in & relive it",
    body: "Scan in at the venue. Afterwards, the event's photo and video gallery opens to people who attended, and no one else.",
    icon: Camera,
    tone: "peacock",
    art: (
      <div>
        <div className="flex items-center gap-2 text-sm font-bold text-[var(--color-success)]"><ScanLine className="h-4 w-4" /> Checked in</div>
        <div className="mt-3 grid max-w-[15rem] grid-cols-6 gap-1.5">
          {["var(--fest-marigold)", "var(--fest-pink)", "var(--fest-peacock)", "var(--fest-saffron)", "var(--color-primary)", "var(--fest-pink)"].map((c, i) => (
            <span key={i} className="aspect-square rounded-md opacity-80" style={{ background: c }} />
          ))}
        </div>
        <p className="muted mt-2 flex items-center gap-1.5 text-xs"><Lock className="h-3.5 w-3.5" /> Private to attendees</p>
      </div>
    ),
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" aria-labelledby="how-title" className="section">
      <div className="container-page">
        <SectionHeader
          id="how-title"
          center
          title={
            <>
              Your next experience is just a few <Marker tone="peacock">steps</Marker> away.
            </>
          }
          lede={
            <>
              Everything that happens on AfterHours, from <Hi tone="saffron">finding an event</Hi> to <Hi tone="peacock">reliving it</Hi>.
            </>
          }
        />
        <ol className="relative mx-auto max-w-5xl">
          {/* Track and its scroll-drawn fill (md up). On mobile each step stacks centred under its node. */}
          <span aria-hidden className="absolute bottom-8 left-1/2 top-8 hidden w-0.5 -translate-x-1/2 rounded bg-[var(--color-line)] md:block" />
          <span aria-hidden data-draw className="absolute bottom-8 left-1/2 top-8 hidden w-0.5 -translate-x-1/2 rounded bg-[linear-gradient(var(--fest-saffron),var(--fest-pink),var(--color-primary),var(--fest-peacock))] md:block" />
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const flip = i % 2 === 1;
            return (
              <li key={step.title} data-step className="relative grid grid-cols-[minmax(0,1fr)] gap-5 pb-12 pt-14 text-center last:pb-0 md:grid-cols-2 md:gap-16 md:pb-14 md:pt-0 md:text-left">
                <span
                  data-step-node
                  className="absolute left-1/2 top-0 z-10 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full ring-8 ring-[var(--color-canvas)]"
                  style={{ background: TONE_STYLES[step.tone].solid, color: TONE_STYLES[step.tone].onSolid }}
                >
                  <Icon aria-hidden className="h-5 w-5" />
                </span>
                <div data-step-part className={`md:pt-1 ${flip ? "md:order-2 md:text-left" : "md:text-right"}`}>
                  <p className="hand text-lg" style={{ color: TONE_STYLES[step.tone].solid }}>
                    step {i + 1}
                  </p>
                  <h3 className="text-2xl font-bold tracking-tight">{step.title}</h3>
                  <p className={`muted mx-auto mt-2 max-w-sm leading-relaxed ${flip ? "md:mx-0" : "md:ml-auto md:mr-0"}`}>{step.body}</p>
                </div>
                <div className={flip ? "md:order-1" : ""}>
                  <Vignette tone={step.tone}>{step.art}</Vignette>
                </div>
              </li>
            );
          })}
        </ol>
        <div data-reveal className="mx-auto mt-14 flex max-w-3xl gap-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-card)] p-5 text-[0.95rem] leading-relaxed text-[var(--color-ink-soft)] sm:p-6">
          <Info aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-accent)]" />
          <p>
            <strong className="font-bold text-[var(--color-ink)]">Interest isn&apos;t a ticket.</strong> Your pass is issued only after your registration, and any payment, is
            confirmed. Each event page shows exactly which steps apply.
          </p>
        </div>
      </div>
    </section>
  );
}
