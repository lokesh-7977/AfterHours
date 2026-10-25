"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { apiFetch } from "@/lib/api-client";

export interface GalleryItem {
  id: string;
  mediaType: "image" | "video";
  filename: string;
  contentUrl: string;
  thumbnailUrl: string | null;
  moderationStatus: string;
  moderationReason: string | null;
  isOwn: boolean;
  uploader: { name: string } | null;
}

const call = <T = unknown,>(path: string, method: string, body?: unknown) => apiFetch<T>(path, { method, body });

export function GalleryGrid({ items }: { items: GalleryItem[] }) {
  const router = useRouter();
  const [open, setOpen] = useState<GalleryItem | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const download = (item: GalleryItem) =>
    start(async () => {
      try {
        // Short-lived (60 s) presigned URL issued only after the server re-checks attendance.
        const { url } = await call<{ url: string }>(`/api/v1/media/${item.id}/download-url`, "POST");
        window.location.assign(url);
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  const remove = (item: GalleryItem) => {
    if (!confirm("Delete this upload permanently?")) return;
    start(async () => {
      try {
        await call(`/api/v1/media/${item.id}`, "DELETE");
        setOpen(null);
        router.refresh();
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  };
  const report = (item: GalleryItem) => {
    const reason = prompt("Why should this be removed? (e.g. I'm in this photo and did not consent)");
    if (!reason) return;
    start(async () => {
      try {
        await call(`/api/v1/media/${item.id}/report`, "POST", { reason });
        setMsg("Reported. The item is hidden while organizers review it.");
        setOpen(null);
        router.refresh();
      } catch (e) {
        setMsg((e as Error).message);
      }
    });
  };

  return (
    <>
      {msg ? <p className="mb-3 text-sm text-[var(--color-warning)]">{msg}</p> : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <button key={item.id} type="button" className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)]" onClick={() => setOpen(item)}>
            {item.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.thumbnailUrl} alt={item.filename} className="h-full w-full object-cover transition group-hover:scale-105" loading="lazy" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-sm">
                <span className="text-3xl">▶</span>
                <span className="muted max-w-full truncate px-2 text-xs">{item.filename}</span>
              </div>
            )}
            {item.moderationStatus !== "approved" ? (
              <span className="badge absolute left-2 top-2 bg-black/70" style={{ color: item.moderationStatus === "rejected" ? "var(--color-danger)" : "var(--color-warning)" }}>
                {item.moderationStatus === "pending" ? "In review" : "Rejected"}
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" role="dialog" aria-modal="true" onClick={() => setOpen(null)}>
          <div className="max-h-full w-full max-w-4xl space-y-3" onClick={(e) => e.stopPropagation()}>
            {open.mediaType === "video" ? (
              // Each range request the player makes is re-authorized server-side.
              <video src={open.contentUrl} controls autoPlay preload="metadata" className="max-h-[75vh] w-full rounded-lg bg-black" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={open.contentUrl} alt={open.filename} className="mx-auto max-h-[75vh] rounded-lg object-contain" />
            )}
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="muted">
                {open.filename}
                {open.uploader ? ` · by ${open.uploader.name}` : ""}
                {open.isOwn && open.moderationReason ? ` · ${open.moderationReason}` : ""}
              </span>
              <div className="flex gap-2">
                {open.moderationStatus === "approved" ? (
                  <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => download(open)}>Download</button>
                ) : null}
                {open.isOwn ? (
                  <button className="btn btn-danger btn-sm" disabled={pending} onClick={() => remove(open)}>Delete</button>
                ) : (
                  <button className="btn btn-sm" disabled={pending} onClick={() => report(open)}>Report / request removal</button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setOpen(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
