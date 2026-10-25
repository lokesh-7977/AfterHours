"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type FormEvent } from "react";
import { markAllNotificationsReadAction, submitPaymentAction, updateProfileAction } from "@/actions/participation";
import { authClient } from "@/lib/auth-client";
import { Field, FormMessage, SubmitButton, type ClientActionResult } from "@/components/form";
import { MediaUploader } from "@/components/media/media-uploader";
import { formatDateTime } from "@/components/ui";
import { PAYMENT_METHOD_LABELS, SUBMITTABLE_PAYMENT_METHODS } from "@/modules/registrations/registration.constants";

export function PaymentForm({ registrationId, eventId, defaults }: { registrationId: string; eventId: string; defaults: { method: string | null; reference: string | null } }) {
  const [state, action] = useActionState(submitPaymentAction.bind(null, registrationId), null);
  const [proofId, setProofId] = useState<string>("");
  const s = state as ClientActionResult | null;
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Payment method" name="method" state={s}>
          <select className="input" id="method" name="method" defaultValue={defaults.method && defaults.method !== "free" ? defaults.method : "upi"}>
            {SUBMITTABLE_PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>{PAYMENT_METHOD_LABELS[m]}</option>
            ))}
          </select>
        </Field>
        <Field label="Transaction reference / UTR" name="reference" state={s}>
          <input className="input" id="reference" name="reference" required minLength={3} maxLength={120} defaultValue={defaults.reference ?? ""} />
        </Field>
      </div>
      <Field label="Note for the organizer (optional)" name="note" state={s}>
        <textarea className="input" id="note" name="note" maxLength={1000} />
      </Field>
      <input type="hidden" name="proofMediaId" value={proofId} />
      <div>
        <p className="label">Payment screenshot (optional)</p>
        <MediaUploader eventId={eventId} purpose="payment_proof" registrationId={registrationId} label={proofId ? "Replace screenshot" : "Attach screenshot"} onUploaded={(m) => setProofId(m.id)} />
        <p className="muted mt-1 text-xs">A screenshot helps the organizer find your payment; it does not confirm it.</p>
      </div>
      <SubmitButton pendingText="Submitting…">Submit for verification</SubmitButton>
      <FormMessage state={s} />
    </form>
  );
}

export function ProfileForm({ name, phone }: { name: string; phone: string | null }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const s = state as ClientActionResult | null;
  return (
    <form action={action} className="space-y-3">
      <Field label="Full name" name="name" state={s}>
        <input className="input" id="name" name="name" defaultValue={name} required minLength={2} maxLength={100} />
      </Field>
      <Field label="Phone" name="phone" state={s} hint="Shared with organizers of events you register for.">
        <input className="input" id="phone" name="phone" defaultValue={phone ?? ""} maxLength={20} />
      </Field>
      <SubmitButton pendingText="Saving…">Save profile</SubmitButton>
      <FormMessage state={s} />
    </form>
  );
}

interface SessionRow {
  id: string;
  token: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
  expiresAt: Date | string;
}

export function SecurityPanel() {
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const [list, me] = await Promise.all([authClient.listSessions(), authClient.getSession()]);
    setSessions((list.data as SessionRow[] | null) ?? []);
    setCurrent(me.data?.session.token ?? null);
  }
  useEffect(() => {
    let alive = true;
    Promise.all([authClient.listSessions(), authClient.getSession()]).then(([list, me]) => {
      if (!alive) return;
      setSessions((list.data as SessionRow[] | null) ?? []);
      setCurrent(me.data?.session.token ?? null);
    });
    return () => {
      alive = false;
    };
  }, []);

  async function changePassword(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const { error } = await authClient.changePassword({
      currentPassword: String(fd.get("currentPassword")),
      newPassword: String(fd.get("newPassword")),
      revokeOtherSessions: true,
    });
    setMsg(error ? (error.message ?? "Could not change password") : "Password changed. Other sessions were signed out.");
    if (!error) {
      e.currentTarget.reset();
      void load();
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={changePassword} className="space-y-3">
        <h3 className="font-semibold">Change password</h3>
        <input className="input" name="currentPassword" type="password" placeholder="Current password" required autoComplete="current-password" />
        <input className="input" name="newPassword" type="password" placeholder="New password (10+ characters)" required minLength={10} maxLength={128} autoComplete="new-password" />
        <button className="btn btn-primary">Update password</button>
        {msg ? <p className="text-sm">{msg}</p> : null}
      </form>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold">Active sessions</h3>
          <button
            className="btn btn-sm"
            onClick={async () => {
              await authClient.revokeOtherSessions();
              void load();
            }}
          >
            Sign out other devices
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {(sessions ?? []).map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 rounded-lg border border-[var(--color-line)] p-2">
              <span className="min-w-0 truncate">
                {s.userAgent?.slice(0, 80) ?? "Unknown device"} <span className="muted">· {formatDateTime(new Date(s.createdAt).toISOString())}</span>
              </span>
              {s.token === current ? (
                <span className="badge" style={{ color: "var(--color-accent)" }}>This device</span>
              ) : (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={async () => {
                    await authClient.revokeSession({ token: s.token });
                    void load();
                    router.refresh();
                  }}
                >
                  Revoke
                </button>
              )}
            </li>
          ))}
          {sessions === null ? <li className="muted">Loading…</li> : null}
        </ul>
      </div>
    </div>
  );
}

export function MarkAllReadButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-ghost btn-sm"
      onClick={async () => {
        await markAllNotificationsReadAction();
        router.refresh();
      }}
    >
      Mark all read
    </button>
  );
}
