import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-guards";
import { listFeedback } from "@/modules/feedback/feedback.service";
import { listCommentsForModeration } from "@/modules/comments/comment.service";
import { listAdminEvents } from "@/modules/events/event.service";
import { Card, EmptyState, PageHeader, Pagination, StatusBadge, formatDateTime, spObject } from "@/components/ui";
import { CommentModeration, FeedbackModeration } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Feedback & comments" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function FeedbackPage({ searchParams }: Props) {
  const user = await requireAdminPage();
  const q = spObject(await searchParams);
  const tab = q.tab === "comments" ? "comments" : "feedback";
  const tabs = (
    <div className="flex gap-2">
      <Link href="/admin/feedback" className={`btn btn-sm ${tab === "feedback" ? "btn-primary" : ""}`}>Feedback</Link>
      <Link href="/admin/feedback?tab=comments" className={`btn btn-sm ${tab === "comments" ? "btn-primary" : ""}`}>Comments</Link>
    </div>
  );

  if (tab === "comments") {
    const scope = q.scope === "recent" ? "recent" : "reported";
    const result = await listCommentsForModeration(user, { page: q.page, scope });
    return (
      <div>
        <PageHeader title="Comments" actions={tabs} />
        <div className="mb-4 flex gap-2 text-sm">
          <Link className={`btn btn-sm ${scope === "reported" ? "btn-primary" : ""}`} href="/admin/feedback?tab=comments&scope=reported">Reported / hidden</Link>
          <Link className={`btn btn-sm ${scope === "recent" ? "btn-primary" : ""}`} href="/admin/feedback?tab=comments&scope=recent">Recent</Link>
        </div>
        {result.items.length === 0 ? (
          <EmptyState title="Nothing to review" />
        ) : (
          <div className="space-y-3">
            {result.items.map((c) => (
              <Card key={c.id} className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{c.author}</span>
                  <StatusBadge status={c.moderationStatus} plain />
                  {c.reportCount ? <span className="text-xs text-[var(--color-danger)]">{c.reportCount} reports</span> : null}
                  <span className="muted text-xs">{formatDateTime(c.createdAt)}</span>
                </div>
                <p className="whitespace-pre-line">{c.body}</p>
                {c.reasons.length ? <p className="muted text-xs">Reasons: {c.reasons.join(" · ")}</p> : null}
                <CommentModeration commentId={c.id} status={c.moderationStatus} />
              </Card>
            ))}
          </div>
        )}
        <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/feedback" params={{ tab: "comments", scope }} />
      </div>
    );
  }

  const [result, events] = await Promise.all([
    listFeedback(user, { page: q.page, eventId: q.eventId, status: q.status }),
    listAdminEvents(user, { pageSize: 100 }),
  ]);
  return (
    <div>
      <PageHeader title="Feedback" description="Only approved feedback is public. Admin notes stay private." actions={tabs} />
      <form className="mb-4 flex flex-wrap gap-2">
        <select className="input max-w-72" name="eventId" defaultValue={q.eventId ?? ""}>
          <option value="">All events</option>
          {events.items.map((e) => (
            <option key={e.id} value={e.id}>{e.title}</option>
          ))}
        </select>
        <select className="input max-w-40" name="status" defaultValue={q.status ?? ""}>
          <option value="">Any status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <button className="btn">Filter</button>
      </form>
      <Card className="mb-4 flex flex-wrap items-center gap-6 text-sm">
        <span>Average <strong>{result.stats.average ? `★ ${result.stats.average}` : "—"}</strong> from {result.stats.count}</span>
        {[5, 4, 3, 2, 1].map((n) => (
          <span key={n} className="muted">{n}★ {result.stats.distribution[n] ?? 0}</span>
        ))}
      </Card>
      {result.items.length === 0 ? (
        <EmptyState title="No feedback" />
      ) : (
        <div className="space-y-3">
          {result.items.map((f) => (
            <Card key={f.id} className="space-y-2 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[var(--color-warning-accent)]">{"★".repeat(f.rating)}</span>
                <span className="font-medium">{f.user?.name}</span>
                <span className="muted text-xs">{f.user?.email}</span>
                <StatusBadge status={f.status} plain />
                {f.revisionCount ? <span className="muted text-xs">revised {f.revisionCount}×</span> : null}
              </div>
              {f.body ? <p className="whitespace-pre-line">{f.body}</p> : null}
              <FeedbackModeration feedbackId={f.id} adminNote={f.adminNote} />
            </Card>
          ))}
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/feedback" params={{ eventId: q.eventId, status: q.status }} />
    </div>
  );
}
