"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { addCommentAction, deleteCommentAction, editCommentAction, reportCommentAction } from "@/actions/comments";
import { FormMessage, SubmitButton, type ClientActionResult } from "@/components/form";
import { formatDateTime } from "@/components/ui";

export interface CommentView {
  id: string;
  parentId: string | null;
  depth: number;
  body: string;
  author: { id: string; name: string } | null;
  isOwn: boolean;
  deleted: boolean;
  edited: boolean;
  moderationStatus: string;
  createdAt: string;
  replies: CommentView[];
}

function CommentForm({ eventId, slug, parentId, onDone, placeholder }: { eventId: string; slug: string; parentId: string | null; onDone?: () => void; placeholder: string }) {
  const router = useRouter();
  const [state, action] = useActionState(async (prev: unknown, fd: FormData) => {
    const res = await addCommentAction(eventId, slug, parentId, null, fd);
    if (res.ok) {
      onDone?.();
      router.refresh();
    }
    return res;
  }, null);
  return (
    <form action={action} className="space-y-2">
      <textarea className="input min-h-20" name="body" required maxLength={2000} placeholder={placeholder} />
      <div className="flex items-center gap-3">
        <SubmitButton className="btn btn-primary btn-sm" pendingText="Posting…">Post</SubmitButton>
        <FormMessage state={state as ClientActionResult | null} />
      </div>
    </form>
  );
}

function Comment({ c, eventId, slug, signedIn }: { c: CommentView; eventId: string; slug: string; signedIn: boolean }) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hidden = c.deleted || c.moderationStatus !== "approved";

  return (
    <div id={`comment-${c.id}`} className={c.depth > 0 ? "border-l border-[var(--color-line)] pl-4" : ""}>
      <div className="py-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-semibold">{c.author?.name ?? "—"}</span>
          <span className="muted">{formatDateTime(c.createdAt)}</span>
          {c.edited ? <span className="muted">(edited)</span> : null}
        </div>
        {editing ? (
          <div className="mt-2 space-y-2">
            <textarea className="input" value={draft} maxLength={2000} onChange={(e) => setDraft(e.target.value)} />
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await editCommentAction(c.id, slug, draft);
                    if (res.ok) {
                      setEditing(false);
                      router.refresh();
                    } else setNote(res.error.message);
                  })
                }
              >
                Save
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          // Rendered as text: React escapes it, so user HTML is never interpreted.
          <p className={`mt-1 whitespace-pre-line text-sm ${hidden ? "muted italic" : ""}`}>{c.body}</p>
        )}
        {!hidden && signedIn ? (
          <div className="mt-1 flex gap-1 text-xs">
            <button className="btn btn-ghost btn-sm" onClick={() => setReplying((v) => !v)}>Reply</button>
            {c.isOwn ? (
              <>
                <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>Edit</button>
                <button
                  className="btn btn-ghost btn-sm"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Delete this comment?")) return;
                    start(async () => {
                      await deleteCommentAction(c.id, slug);
                      router.refresh();
                    });
                  }}
                >
                  Delete
                </button>
              </>
            ) : (
              <button
                className="btn btn-ghost btn-sm"
                disabled={pending}
                onClick={() => {
                  const reason = prompt("Why are you reporting this comment?");
                  if (!reason) return;
                  start(async () => {
                    const res = await reportCommentAction(c.id, reason);
                    setNote(res.ok ? "Reported. Thank you." : res.error.message);
                  });
                }}
              >
                Report
              </button>
            )}
          </div>
        ) : null}
        {note ? <p className="muted text-xs">{note}</p> : null}
        {replying ? (
          <div className="mt-2">
            <CommentForm eventId={eventId} slug={slug} parentId={c.id} onDone={() => setReplying(false)} placeholder={`Reply to ${c.author?.name ?? "comment"}`} />
          </div>
        ) : null}
      </div>
      {c.replies.map((r) => (
        <Comment key={r.id} c={r} eventId={eventId} slug={slug} signedIn={signedIn} />
      ))}
    </div>
  );
}

export function CommentsSection({ eventId, slug, comments, signedIn }: { eventId: string; slug: string; comments: CommentView[]; signedIn: boolean }) {
  return (
    <div className="space-y-4">
      {signedIn ? (
        <CommentForm eventId={eventId} slug={slug} parentId={null} placeholder="Ask a question or say hello…" />
      ) : (
        <p className="muted text-sm">
          <Link className="link" href={`/login?next=/event/${slug}`}>Log in</Link> to join the conversation.
        </p>
      )}
      <div className="divide-y divide-[var(--color-line)]">
        {comments.length === 0 ? <p className="muted py-4 text-sm">No comments yet.</p> : comments.map((c) => <Comment key={c.id} c={c} eventId={eventId} slug={slug} signedIn={signedIn} />)}
      </div>
    </div>
  );
}
