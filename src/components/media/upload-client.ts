"use client";

/** Browser side of the direct-to-R2 upload protocol (see modules/media/media.service.ts). */
import { apiFetch } from "@/lib/api-client";

export interface UploadedMedia {
  id: string;
  processingStatus: string;
  moderationStatus: string;
  contentUrl: string;
  thumbnailUrl: string | null;
  filename: string;
  mediaType: "image" | "video";
}

type Instructions =
  | { mediaId: string; strategy: "single"; uploadUrl: string; headers: Record<string, string> }
  | { mediaId: string; strategy: "multipart"; partSize: number; partCount: number };

export class UploadError extends Error {
  constructor(message: string, readonly reason?: string) {
    super(message);
  }
}

const api = <T,>(path: string, body: unknown = {}, method = "POST") => apiFetch<T>(path, { method, body: method === "DELETE" ? undefined : body });

function putWithProgress(url: string, blob: Blob, headers: Record<string, string>, onProgress: (loaded: number) => void, signal?: AbortSignal): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.getResponseHeader("ETag")) : reject(new UploadError(`Storage rejected the upload (${xhr.status})`)));
    xhr.onerror = () => reject(new UploadError("Network error during upload"));
    xhr.onabort = () => reject(new UploadError("Upload cancelled", "ABORTED"));
    signal?.addEventListener("abort", () => xhr.abort());
    xhr.send(blob);
  });
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (err instanceof UploadError && err.reason === "ABORTED") throw err;
      last = err;
      await new Promise((r) => setTimeout(r, 800 * 2 ** i));
    }
  }
  throw last;
}

export async function uploadFile(
  file: File,
  target: { eventId: string; purpose: "gallery" | "poster" | "promo" | "payment_proof"; registrationId?: string },
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedMedia> {
  if (!file.type) throw new UploadError("Unknown file type");
  const ins = await api<Instructions>("/api/v1/media/uploads", { ...target, filename: file.name, contentType: file.type, size: file.size });
  try {
    if (ins.strategy === "single") {
      await withRetry(() => putWithProgress(ins.uploadUrl, file, ins.headers, (n) => onProgress(n / file.size), signal));
      onProgress(1);
      return await withRetry(() => api<UploadedMedia>(`/api/v1/media/uploads/${ins.mediaId}/complete`, {}), 3);
    }
    // Multipart: sign parts in batches, upload 3 at a time, each part retried independently.
    const loaded = new Array<number>(ins.partCount).fill(0);
    const parts: { partNumber: number; etag: string }[] = [];
    const queue = Array.from({ length: ins.partCount }, (_, i) => i + 1);
    const report = () => onProgress(loaded.reduce((a, b) => a + b, 0) / file.size);
    while (queue.length) {
      const batch = queue.splice(0, 9);
      const { parts: signed } = await api<{ parts: { partNumber: number; url: string }[] }>(`/api/v1/media/uploads/${ins.mediaId}/parts`, { partNumbers: batch });
      for (let i = 0; i < signed.length; i += 3) {
        await Promise.all(
          signed.slice(i, i + 3).map(async ({ partNumber, url }) => {
            const start = (partNumber - 1) * ins.partSize;
            const blob = file.slice(start, Math.min(start + ins.partSize, file.size));
            const etag = await withRetry(() =>
              putWithProgress(url, blob, {}, (n) => {
                loaded[partNumber - 1] = n;
                report();
              }, signal),
            );
            if (!etag) throw new UploadError("Storage did not return an ETag (check R2 CORS ExposeHeaders)");
            parts.push({ partNumber, etag });
          }),
        );
      }
    }
    return await withRetry(() => api<UploadedMedia>(`/api/v1/media/uploads/${ins.mediaId}/complete`, { parts }), 3);
  } catch (err) {
    // Release the pending record and any partial object; maintenance also cleans up leftovers.
    await api(`/api/v1/media/uploads/${ins.mediaId}`, undefined, "DELETE").catch(() => undefined);
    throw err;
  }
}
