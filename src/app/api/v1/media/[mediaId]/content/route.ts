import type { NextRequest } from "next/server";
import { apiRoute, readId } from "@/lib/http";
import { getSessionUser } from "@/lib/auth-guards";
import { errors } from "@/lib/errors";
import { RATE_LIMITS, enforceRateLimit } from "@/lib/rate-limit";
import { getStorage, contentDisposition } from "@/infrastructure/storage/r2-storage.service";
import { authorizeMediaRead } from "@/modules/media/media.service";

const RANGE = /^bytes=\d*-\d*$/;

/**
 * Authorized private delivery. Every request, including each byte-range
 * request a video player makes while seeking, re-runs the authorization, and
 * private responses are marked uncacheable so shared caches never store them.
 */
export const GET = apiRoute<{ mediaId: string }>(async (req: NextRequest, { params }) => {
  const mediaId = readId(params.mediaId, "Media");
  const variant = req.nextUrl.searchParams.get("variant") === "thumbnail" ? "thumbnail" : "original";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const user = await getSessionUser();
  if (user) await enforceRateLimit("media-read:" + user.id, RATE_LIMITS.mediaDownloads);
  const { media, access, key, contentType } = await authorizeMediaRead(user, mediaId, variant);

  const range = req.headers.get("range");
  if (range && !RANGE.test(range)) throw errors.badRequest("Invalid range", "INVALID_RANGE");
  const object = await getStorage().getStream(key, range);

  const headers = new Headers({
    "Content-Type": contentType,
    "Content-Length": String(object.contentLength),
    "Accept-Ranges": "bytes",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": contentDisposition(download ? "attachment" : "inline", variant === "original" ? media.originalFilename : undefined),
    "Cache-Control": access === "public" ? "public, max-age=300" : "private, no-store",
    Vary: "Cookie",
  });
  if (object.contentRange) headers.set("Content-Range", object.contentRange);
  return new Response(object.body, { status: object.status, headers });
});
