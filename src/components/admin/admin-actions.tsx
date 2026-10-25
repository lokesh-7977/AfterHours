"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import {
  attendanceCorrectionAction,
  createCodeAction,
  manualCheckInAction,
  moderateCommentAction,
  moderateFeedbackAction,
  moderateMediaAction,
  passAction,
  paymentDecisionAction,
  revokeCodeAction,
  revokeSessionsAction,
  runMaintenanceAction,
  setRoleAction,
} from "@/actions/admin";
import { deleteCommentAction } from "@/actions/comments";
import { FormMessage, SubmitButton, type ClientActionResult } from "@/components/form";

export function PaymentDecision({ registrationId, paymentStatus, status }: { registrationId: string; paymentStatus: string; status: string }) {
  const [state, action] = useActionState(paymentDecisionAction.bind(null, registrationId), null);
  const s = state as ClientActionResult | null;
  if (status !== "registered") return null;
  return (
    <div className="space-y-2">
      {["pending", "submitted", "rejected"].includes(paymentStatus) ? (
        <form action={action} className="flex flex-wrap gap-2">
          <input type="hidden" name="decision" value="approve" />
          <input className="input max-w-56 text-xs" name="note" placeholder="Internal note (optional)" maxLength={500} />
          <SubmitButton className="btn btn-primary btn-sm" pendingText="Approving…">Approve & issue pass</SubmitButton>
        </form>
      ) : null}
      {["pending", "submitted"].includes(paymentStatus) ? (
        <form action={action} className="flex flex-wrap gap-2">
          <input type="hidden" name="decision" value="reject" />
          <input className="input max-w-56 text-xs" name="reason" placeholder="Reason shown to participant" required minLength={3} maxLength={1000} />
          <SubmitButton className="btn btn-danger btn-sm" pendingText="Rejecting…">Reject</SubmitButton>
        </form>
      ) : null}
      {paymentStatus === "approved" ? (
        <form action={action} className="flex flex-wrap gap-2" onSubmit={(e) => !confirm("Record a refund? The pass will be revoked and the seat released.") && e.preventDefault()}>
          <input type="hidden" name="decision" value="refund" />
          <input className="input max-w-56 text-xs" name="reason" placeholder="Refund reason" required minLength={3} maxLength={1000} />
          <SubmitButton className="btn btn-danger btn-sm" pendingText="Saving…">Record refund</SubmitButton>
        </form>
      ) : (
        <form action={action} className="flex flex-wrap gap-2" onSubmit={(e) => !confirm("Cancel this registration and release the seat?") && e.preventDefault()}>
          <input type="hidden" name="decision" value="cancel" />
          <input type="hidden" name="reason" value="Cancelled by organizer" />
          <SubmitButton className="btn btn-ghost btn-sm" pendingText="…">Cancel registration</SubmitButton>
        </form>
      )}
      <FormMessage state={s} />
    </div>
  );
}

export function PassControls({ registrationId, passStatus, attendanceStatus }: { registrationId: string; passStatus: string | null; attendanceStatus: string | null }) {
  const [state, action] = useActionState(passAction.bind(null, registrationId), null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!passStatus) return null;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {passStatus === "active" && attendanceStatus !== "verified" ? (
          <button
            className="btn btn-sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await manualCheckInAction(registrationId);
                setMsg(res.ok ? "Checked in" : res.error.message);
                router.refresh();
              })
            }
          >
            Manual check-in
          </button>
        ) : null}
        <form action={action}>
          <SubmitButton className="btn btn-sm" name="action" value="reissue" pendingText="…">{passStatus === "active" ? "Rotate QR" : "Reissue pass"}</SubmitButton>
        </form>
        {passStatus === "active" ? (
          <form action={action} className="flex gap-1">
            <input type="hidden" name="action" value="revoke" />
            <input className="input max-w-40 text-xs" name="reason" placeholder="Revoke reason" required minLength={3} />
            <SubmitButton className="btn btn-danger btn-sm" pendingText="…">Revoke</SubmitButton>
          </form>
        ) : null}
      </div>
      {msg ? <p className="text-xs">{msg}</p> : null}
      <FormMessage state={state as ClientActionResult | null} />
    </div>
  );
}

export function CodeGenerator({ eventId }: { eventId: string }) {
  const [state, action] = useActionState(createCodeAction.bind(null, eventId), null);
  const s = state as ClientActionResult<{ code: string }> | null;
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <input className="input" name="label" placeholder="Label (e.g. Main gate)" maxLength={80} />
        <select className="input" name="expiresInMinutes" defaultValue="180" aria-label="Valid for">
          <option value="30">Valid 30 min</option>
          <option value="60">Valid 1 hour</option>
          <option value="180">Valid 3 hours</option>
          <option value="480">Valid 8 hours</option>
          <option value="1440">Valid 24 hours</option>
        </select>
        <input className="input" name="maxUses" type="number" min={1} placeholder="Max uses (optional)" />
      </div>
      <SubmitButton pendingText="Generating…">Generate code</SubmitButton>
      {s?.ok ? (
        <div className="rounded-lg border border-[var(--color-accent)] p-4 text-center">
          <p className="muted text-xs">Display this code at the venue. It is shown only once.</p>
          <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-[var(--color-accent)]">{s.data.code}</p>
        </div>
      ) : (
        <FormMessage state={s} />
      )}
    </form>
  );
}

export function RevokeCodeButton({ codeId }: { codeId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      className="btn btn-danger btn-sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await revokeCodeAction(codeId);
          router.refresh();
        })
      }
    >
      Revoke
    </button>
  );
}

export function AttendanceCorrection({ attendanceId, status }: { attendanceId: string; status: string }) {
  const [state, action] = useActionState(attendanceCorrectionAction.bind(null, attendanceId), null);
  return (
    <div className="flex flex-wrap gap-1">
      {status === "pending_confirmation" ? (
        <form action={action}>
          <SubmitButton className="btn btn-primary btn-sm" name="action" value="confirm" pendingText="…">Confirm</SubmitButton>
        </form>
      ) : null}
      {status !== "revoked" ? (
        <form action={action} className="flex gap-1" onSubmit={(e) => !confirm("Revoke this attendance? Gallery access will be removed.") && e.preventDefault()}>
          <input type="hidden" name="action" value="revoke" />
          <input className="input max-w-36 text-xs" name="reason" placeholder="Reason" required minLength={3} />
          <SubmitButton className="btn btn-danger btn-sm" pendingText="…">Revoke</SubmitButton>
        </form>
      ) : null}
      <FormMessage state={state as ClientActionResult | null} />
    </div>
  );
}

export function MediaModeration({ mediaId }: { mediaId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) setErr(res.error?.message ?? "Failed");
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-1">
      <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => moderateMediaAction(mediaId, "approved"))}>Approve</button>
      <button
        className="btn btn-sm"
        disabled={pending}
        onClick={() => {
          const reason = prompt("Reason for rejection (shown to uploader)") ?? undefined;
          run(() => moderateMediaAction(mediaId, "rejected", reason));
        }}
      >
        Reject
      </button>
      <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => confirm("Delete permanently?") && run(async () => (await import("@/actions/admin")).deleteMediaAction(mediaId))}>
        Delete
      </button>
      {err ? <span className="text-xs text-[var(--color-danger)]">{err}</span> : null}
    </div>
  );
}

export function CommentModeration({ commentId, status }: { commentId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<ClientActionResult<unknown>>) =>
    start(async () => {
      const res = await fn();
      setErr(res.ok ? null : res.error.message);
      router.refresh();
    });
  return (
    <div className="flex flex-wrap gap-1">
      {status !== "approved" ? <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => moderateCommentAction(commentId, "approved"))}>Restore</button> : null}
      {status !== "rejected" ? <button className="btn btn-sm" disabled={pending} onClick={() => run(() => moderateCommentAction(commentId, "rejected"))}>Hide</button> : null}
      <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => confirm("Delete this comment?") && run(() => deleteCommentAction(commentId))}>Delete</button>
      {err ? <span className="text-xs text-[var(--color-danger)]">{err}</span> : null}
    </div>
  );
}

export function FeedbackModeration({ feedbackId, adminNote }: { feedbackId: string; adminNote: string | null }) {
  const [state, action] = useActionState(moderateFeedbackAction.bind(null, feedbackId), null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-1">
      <input className="input max-w-48 text-xs" name="adminNote" placeholder="Private admin note" defaultValue={adminNote ?? ""} maxLength={1000} />
      <SubmitButton className="btn btn-primary btn-sm" name="decision" value="approved" pendingText="…">Publish</SubmitButton>
      <SubmitButton className="btn btn-sm" name="decision" value="rejected" pendingText="…">Reject</SubmitButton>
      <FormMessage state={state as ClientActionResult | null} />
    </form>
  );
}

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState(setRoleAction.bind(null, userId), null);
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <form action={action} className="flex gap-1" onSubmit={(e) => !confirm("Change this user's role? Their sessions will be revoked.") && e.preventDefault()}>
        <select className="input text-xs" name="role" defaultValue={role} aria-label="Role">
          <option value="participant">participant</option>
          <option value="admin">admin</option>
          <option value="super_admin">super_admin</option>
        </select>
        <SubmitButton className="btn btn-sm" pendingText="…">Save</SubmitButton>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await revokeSessionsAction(userId);
              router.refresh();
            })
          }
        >
          Sign out everywhere
        </button>
      </form>
      <FormMessage state={state as ClientActionResult | null} />
    </div>
  );
}

export function MaintenanceButton() {
  const [result, setResult] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button
        className="btn"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await runMaintenanceAction();
            setResult(res.ok ? JSON.stringify(res.data, null, 2) : res.error.message);
          })
        }
      >
        {pending ? "Running…" : "Run maintenance now"}
      </button>
      {result ? <pre className="overflow-x-auto rounded bg-[var(--color-subtle)] p-3 font-mono text-xs">{result}</pre> : null}
    </div>
  );
}
