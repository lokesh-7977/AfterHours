"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { BookmarkCheck, BookmarkPlus } from "lucide-react";
import { cancelRegistrationAction, registerAction, submitFeedbackAction, toggleInterestAction, verifyCodeAction } from "@/actions/participation";
import { FormMessage, SubmitButton, type ClientActionResult } from "@/components/form";
import { celebrate, popFrom } from "@/components/motion/confetti";

/**
 * Interest is a bookmark, never a ticket. `compact` is the event-card version (no count).
 * Signed-out visitors are sent to log in and brought back to the event.
 */
export function InterestButton({
  eventId,
  slug,
  interested,
  count,
  signedIn,
  compact = false,
}: {
  eventId: string;
  slug: string;
  interested: boolean;
  count: number;
  signedIn: boolean;
  compact?: boolean;
}) {
  const [state, setState] = useState({ interested, count });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const size = compact ? "btn-sm min-h-10" : "w-full";
  const countLabel = compact ? null : <span className="font-medium opacity-70">{state.count}</span>;
  if (!signedIn) {
    return (
      <Link href={`/login?next=/event/${slug}`} className={`btn ${size} relative z-10`}>
        <BookmarkPlus aria-hidden className="h-4 w-4" />
        Express Interest
        {countLabel}
      </Link>
    );
  }
  return (
    <div className="relative z-10">
      <button
        type="button"
        className={`btn ${size} ${state.interested ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]" : ""}`}
        disabled={pending}
        aria-pressed={state.interested}
        onClick={(e) => {
          const button = e.currentTarget;
          start(async () => {
            setError(null);
            const res = await toggleInterestAction(eventId, state.interested, slug);
            if (res.ok) {
              setState({ interested: res.data.interested, count: res.data.interestCount });
              if (res.data.interested) popFrom(button, "sm");
            } else setError(res.error.message);
          });
        }}
      >
        {state.interested ? <BookmarkCheck aria-hidden className="h-4 w-4" /> : <BookmarkPlus aria-hidden className="h-4 w-4" />}
        {state.interested ? "Interested" : "Express Interest"}
        {countLabel}
      </button>
      {error ? (
        <p className="mt-1 text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RegisterButton({ eventId, slug, label }: { eventId: string; slug: string; label: string }) {
  const [state, action] = useActionState(registerAction.bind(null, eventId, slug), null);
  // A confirmed registration deserves the full celebration.
  useEffect(() => {
    if (state?.ok) celebrate();
  }, [state]);
  return (
    <form action={action} className="space-y-2">
      <SubmitButton className="btn btn-primary w-full" pendingText="Reserving your seat…">{label}</SubmitButton>
      <FormMessage state={state as ClientActionResult | null} />
    </form>
  );
}

export function CancelRegistrationButton({ registrationId }: { registrationId: string }) {
  const [state, action] = useActionState(cancelRegistrationAction.bind(null, registrationId), null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Cancel this registration? Your seat will be released.")) e.preventDefault();
      }}
    >
      <SubmitButton className="btn btn-danger btn-sm" pendingText="Cancelling…">Cancel registration</SubmitButton>
      <FormMessage state={state as ClientActionResult | null} />
    </form>
  );
}

export function CodeCheckInForm({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(verifyCodeAction.bind(null, eventId), null);
  const outcome = state?.ok ? state.data : null;
  return (
    <form action={action} className="space-y-2">
      <label className="label" htmlFor={`code-${eventId}`}>Attendance code (shown at the venue)</label>
      <div className="flex gap-2">
        <input className="input font-mono uppercase" id={`code-${eventId}`} name="code" placeholder="ABCD-EFGH" required maxLength={20} autoComplete="off" />
        <SubmitButton className="btn btn-primary" pendingText="Checking…">Check in</SubmitButton>
      </div>
      {outcome ? (
        <p className={`text-sm ${outcome.outcome === "pending_confirmation" ? "text-[var(--color-warning)]" : "text-[var(--color-success)]"}`} role="status">
          {outcome.message}
        </p>
      ) : (
        <FormMessage state={state as ClientActionResult | null} />
      )}
    </form>
  );
}

export function FeedbackForm({ eventId, slug, initial }: { eventId: string; slug: string; initial: { rating: number; body: string | null; status: string } | null }) {
  const [state, action] = useActionState(submitFeedbackAction.bind(null, eventId, slug), null);
  const [rating, setRating] = useState(initial?.rating ?? 0);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="rating" value={rating || ""} />
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            className="text-2xl"
            style={{ color: n <= rating ? "var(--color-warning)" : "var(--color-faint)" }}
            onClick={() => setRating(n)}
          >
            ★
          </button>
        ))}
      </div>
      <textarea className="input min-h-24" name="body" maxLength={3000} placeholder="What did you think? (optional)" defaultValue={initial?.body ?? ""} />
      {initial ? <p className="muted text-xs">Your feedback is {initial.status}. Submitting again revises it and sends it back for review.</p> : null}
      <SubmitButton disabled={!rating} pendingText="Sending…">{initial ? "Update feedback" : "Submit feedback"}</SubmitButton>
      <FormMessage state={state as ClientActionResult | null} />
    </form>
  );
}
