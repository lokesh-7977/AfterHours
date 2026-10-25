"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

import type { ActionResult } from "@/lib/action";

/** Same type the Server Actions return (type-only import: nothing server-side is bundled). */
export type ClientActionResult<T = unknown> = ActionResult<T>;

export function SubmitButton({ children, className = "btn btn-primary", pendingText, name, value, disabled }: { children: ReactNode; className?: string; pendingText?: string; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} name={name} value={value}>
      {pending ? (pendingText ?? "Working…") : children}
    </button>
  );
}

export function FormMessage({ state }: { state: ClientActionResult | null | undefined }) {
  if (!state) return null;
  if (state.ok) return state.message ? <p className="text-sm text-[var(--color-success)]" role="status">{state.message}</p> : null;
  const formErrors = state.error.fieldErrors?._form;
  return (
    <p className="text-sm text-[var(--color-danger)]" role="alert">
      {formErrors?.length ? formErrors.join(" ") : state.error.message}
    </p>
  );
}

export function Field({
  label,
  name,
  state,
  hint,
  children,
}: {
  label: string;
  name: string;
  state?: ClientActionResult | null;
  hint?: ReactNode;
  children: ReactNode;
}) {
  const errs = state && !state.ok ? state.error.fieldErrors?.[name] : undefined;
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      {children}
      {hint && !errs ? <p className="muted mt-1 text-xs">{hint}</p> : null}
      {errs?.length ? <p className="mt-1 text-xs text-[var(--color-danger)]">{errs.join(" ")}</p> : null}
    </div>
  );
}
