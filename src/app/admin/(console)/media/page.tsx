import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminPage } from "@/lib/page-guards";
import { listModerationQueue } from "@/modules/media/media.service";
import { Badge, EmptyState, PageHeader, Pagination, spObject } from "@/components/ui";
import { MediaModeration } from "@/components/admin/admin-actions";

export const metadata: Metadata = { title: "Media moderation" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function MediaModerationPage({ searchParams }: Props) {
  const user = await requireAdminPage();
  const q = spObject(await searchParams);
  const status = q.status === "approved" || q.status === "rejected" ? q.status : "pending";
  const result = await listModerationQueue(user, { page: q.page, status, eventId: q.eventId, pageSize: 24 });

  return (
    <div>
      <PageHeader title="Gallery moderation" description="Reported items are listed first. Removal requests hide media until reviewed." />
      <div className="mb-4 flex gap-2">
        {(["pending", "approved", "rejected"] as const).map((s) => (
          <Link key={s} href={`/admin/media?status=${s}`} className={`btn btn-sm ${status === s ? "btn-primary" : ""}`}>{s}</Link>
        ))}
      </div>
      {result.items.length === 0 ? (
        <EmptyState title="Queue is empty" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.items.map((m) => (
            <div key={m.id} className="card space-y-2 p-3">
              <a href={m.contentUrl} target="_blank" rel="noopener noreferrer" className="block aspect-video overflow-hidden rounded bg-[var(--color-surface)]">
                {m.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.thumbnailUrl} alt={m.filename} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full items-center justify-center text-sm">▶ {m.filename}</span>
                )}
              </a>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="muted truncate">by {m.uploader?.name}</span>
                {m.reportCount ? <Badge tone="red">{m.reportCount} report{m.reportCount > 1 ? "s" : ""}</Badge> : null}
                <Badge>{m.mediaType}</Badge>
              </div>
              <MediaModeration mediaId={m.id} />
            </div>
          ))}
        </div>
      )}
      <Pagination page={result.page} totalPages={result.totalPages} basePath="/admin/media" params={{ status }} />
    </div>
  );
}
