"use client";

import { useRef, useState } from "react";
import { uploadFile, type UploadedMedia } from "./upload-client";

interface Item {
  key: string;
  file: File;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
  result?: UploadedMedia;
}

const ACCEPT = {
  images: "image/jpeg,image/png,image/webp,image/avif",
  media: "image/jpeg,image/png,image/webp,image/avif,video/mp4,video/webm,video/quicktime",
};

export function MediaUploader({
  eventId,
  purpose,
  registrationId,
  multiple = false,
  accept = purpose === "gallery" ? "media" : "images",
  label = "Choose files",
  onUploaded,
}: {
  eventId: string;
  purpose: "gallery" | "poster" | "promo" | "payment_proof";
  registrationId?: string;
  multiple?: boolean;
  accept?: keyof typeof ACCEPT;
  label?: string;
  onUploaded?: (media: UploadedMedia) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const update = (key: string, patch: Partial<Item>) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  async function start(item: Item) {
    update(item.key, { status: "uploading", progress: 0, error: undefined });
    try {
      const result = await uploadFile(item.file, { eventId, purpose, registrationId }, (p) => update(item.key, { progress: p }));
      update(item.key, { status: "done", progress: 1, result });
      onUploaded?.(result);
    } catch (err) {
      update(item.key, { status: "error", error: err instanceof Error ? err.message : "Upload failed" });
    }
  }

  function onFiles(files: FileList | null) {
    if (!files) return;
    const next = Array.from(files).map((file) => ({ key: `${file.name}-${file.size}-${Math.random()}`, file, progress: 0, status: "uploading" as const }));
    setItems((prev) => [...next, ...prev]);
    for (const it of next) void start(it);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      <label className="btn cursor-pointer">
        {label}
        <input ref={inputRef} type="file" className="sr-only" accept={ACCEPT[accept]} multiple={multiple} onChange={(e) => onFiles(e.target.files)} />
      </label>
      {items.length ? (
        <ul className="space-y-2 text-sm">
          {items.map((it) => (
            <li key={it.key} className="rounded-lg border border-[var(--color-line)] p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate">{it.file.name}</span>
                <span className="muted shrink-0 text-xs">
                  {it.status === "uploading" ? `${Math.round(it.progress * 100)}%` : it.status === "done" ? (it.result?.moderationStatus === "pending" ? "Uploaded · awaiting review" : "Uploaded ✓") : "Failed"}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded bg-[var(--color-surface)]">
                <div className="h-full bg-[var(--color-accent)] transition-all" style={{ width: `${Math.round(it.progress * 100)}%` }} />
              </div>
              {it.status === "error" ? (
                <div className="mt-1 flex items-center justify-between text-xs text-[var(--color-danger)]">
                  <span>{it.error}</span>
                  <button type="button" className="btn btn-sm" onClick={() => start(it)}>Retry</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
