"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, KeyRound, LogIn, MailCheck, UserPlus } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { celebrate } from "@/components/motion/confetti";
import { isAdminRole, toRole } from "@/modules/auth/roles";

const SERVER_ERROR = "The server could not complete the request. Please try again shortly.";

function safeNext(next: string | null, fallback: string): string {
  // Only same-site relative paths: prevents open redirects via ?next=
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

/** Password field with a show/hide toggle (mobile keyboards make typos easy to miss). */
function PasswordInput({ id, label, autoComplete, minLength, maxLength, hint }: { id: string; label: string; autoComplete: string; minLength?: number; maxLength?: number; hint?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label className="label" htmlFor={id}>{label}</label>
      <div className="relative">
        <input className="input pr-12" id={id} name={id} type={visible ? "text" : "password"} autoComplete={autoComplete} required minLength={minLength} maxLength={maxLength} />
        <button
          type="button"
          className="absolute right-1.5 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[var(--color-muted)] hover:bg-[var(--color-subtle)] hover:text-[var(--color-ink)]"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
        >
          {visible ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
        </button>
      </div>
      {hint ? <p className="muted mt-1 text-xs">{hint}</p> : null}
    </div>
  );
}

function ErrorText({ message }: { message: string | null }) {
  return message ? (
    <p className="text-sm text-[var(--color-danger)]" role="alert">
      {message}
    </p>
  ) : null;
}

export function LoginForm({ mode }: { mode: "participant" | "admin" }) {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get("error") === "forbidden" ? "That account does not have administrator access." : null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setPending(true);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const { data, error: err } = await authClient.signIn.email({ email, password: String(fd.get("password") ?? "") });
    if (err) {
      setPending(false);
      if (err.status === 403) {
        setInfo("Please verify your email first. We just sent you a new verification link.");
        await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard?verified=1" });
      } else if (err.status === 429) setError("Too many attempts. Please wait a minute and try again.");
      else if (err.status >= 500) setError(SERVER_ERROR);
      else setError("Invalid email or password.");
      return;
    }
    // The admin console is still protected server-side; this check only keeps
    // participants out of the admin login flow with a clear message.
    const isAdmin = isAdminRole(toRole(data?.user.role));
    if (mode === "admin" && !isAdmin) {
      await authClient.signOut();
      setPending(false);
      setError("That account does not have administrator access.");
      return;
    }
    if (!isAdmin) celebrate();
    router.push(isAdmin ? safeNext(params.get("next"), "/admin/dashboard") : safeNext(params.get("next"), "/dashboard"));
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <PasswordInput id="password" label="Password" autoComplete="current-password" />
      <ErrorText message={error} />
      {info ? <p className="text-sm text-[var(--color-info)]">{info}</p> : null}
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        <LogIn aria-hidden className="h-4 w-4" />
        {pending ? "Signing in…" : mode === "admin" ? "Sign in to admin console" : "Log in"}
      </button>
      {mode === "participant" ? (
        <div className="flex flex-col items-center gap-2 text-sm sm:flex-row sm:justify-between">
          <Link className="link" href="/forgot-password">Forgot password?</Link>
          <Link className="link" href="/register">New here? Create an account</Link>
        </div>
      ) : null}
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password !== fd.get("confirm")) return setError("Passwords do not match.");
    setPending(true);
    // No role is sent: Better Auth rejects client-supplied roles (input: false).
    const { data, error: err } = await authClient.signUp.email({
      name: String(fd.get("name") ?? ""),
      email: String(fd.get("email") ?? ""),
      password,
      callbackURL: "/dashboard?verified=1",
    });
    setPending(false);
    if (err) return setError(err.status === 429 ? "Too many sign-ups from this network. Try later." : err.status >= 500 ? SERVER_ERROR : (err.message ?? "Could not create the account."));
    celebrate();
    if (data && "token" in data && data.token) {
      router.push("/dashboard");
      router.refresh();
    } else setDone(true);
  }

  if (done) {
    return (
      <div className="rounded-2xl bg-[var(--fest-peacock-soft)] p-5 text-center" role="status">
        <MailCheck aria-hidden className="mx-auto h-8 w-8 text-[var(--fest-peacock-text)]" />
        <p className="mt-2 font-semibold">You&apos;re almost in!</p>
        <p className="muted mt-1 text-sm">Check your inbox for a verification link. Once verified you&apos;ll be signed in automatically.</p>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Full name</label>
        <input className="input" id="name" name="name" required minLength={2} maxLength={100} autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <PasswordInput id="password" label="Password" autoComplete="new-password" minLength={10} maxLength={128} hint="At least 10 characters." />
      <PasswordInput id="confirm" label="Confirm password" autoComplete="new-password" minLength={10} />
      <ErrorText message={error} />
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        <UserPlus aria-hidden className="h-4 w-4" />
        {pending ? "Creating account…" : "Create account"}
      </button>
      <p className="muted text-center text-sm">
        Already registered? <Link className="link" href="/login">Log in</Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    const fd = new FormData(e.currentTarget);
    await authClient.requestPasswordReset({ email: String(fd.get("email") ?? ""), redirectTo: "/reset-password" });
    setPending(false);
    setSent(true); // same message whether or not the account exists
  }
  if (sent)
    return (
      <div className="rounded-2xl bg-[var(--fest-peacock-soft)] p-5 text-center" role="status">
        <MailCheck aria-hidden className="mx-auto h-8 w-8 text-[var(--fest-peacock-text)]" />
        <p className="muted mt-2 text-sm">If an account exists for that email, a reset link is on its way.</p>
      </div>
    );
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" required autoComplete="email" />
      </div>
      <button className="btn btn-primary btn-lg w-full" disabled={pending}>
        <MailCheck aria-hidden className="h-4 w-4" />
        {pending ? "Sending…" : "Send reset link"}
      </button>
      <p className="muted text-center text-sm">
        Remembered it? <Link className="link" href="/login">Log in</Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(params.get("error") ? "This reset link is invalid or has expired." : null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newPassword = String(fd.get("password") ?? "");
    if (newPassword !== fd.get("confirm")) return setError("Passwords do not match.");
    if (!token) return setError("Missing reset token.");
    setPending(true);
    const { error: err } = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (err) return setError(err.message ?? "Could not reset the password.");
    router.push("/login?reset=1");
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <PasswordInput id="password" label="New password" autoComplete="new-password" minLength={10} maxLength={128} hint="At least 10 characters." />
      <PasswordInput id="confirm" label="Confirm new password" autoComplete="new-password" minLength={10} />
      <ErrorText message={error} />
      <button className="btn btn-primary btn-lg w-full" disabled={pending || !token}>
        <KeyRound aria-hidden className="h-4 w-4" />
        {pending ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
