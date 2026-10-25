# Deployment & operations

## 1. Configuration

All variables are documented in `.env.example` and validated with Zod on first use (`src/lib/env.ts`).

Required: `MONGODB_URI`, `BETTER_AUTH_SECRET` (≥ 32 chars), `BETTER_AUTH_URL`, `APP_URL`.
Optional groups: R2 (`R2_*`), email (`EMAIL_PROVIDER=resend` + `EMAIL_PROVIDER_API_KEY`), `CRON_SECRET`, media limits.

`BETTER_AUTH_SECRET` also derives (HKDF, purpose-bound) the keys that encrypt QR pass tokens and hash attendance codes. Rotating it signs everyone out, invalidates outstanding attendance codes and makes existing passes unreadable — reissue passes (admin → Registrations → *Reissue pass*) after rotation.

`R2_PUBLIC_BASE_URL` is deliberately unused: R2 public access exposes the entire bucket, which would leak private galleries. Posters are served through `/api/v1/media/{id}/content` with public caching only when the event is public.

## 2. Deploy checklist

1. `pnpm install --frozen-lockfile && pnpm build`
2. `pnpm db:indexes` (indexes are not built at application start in production)
3. `pnpm seed:admin` once; then remove `ADMIN_SEED_PASSWORD`
4. R2: private bucket, API token scoped to that bucket, then `pnpm r2:cors`
5. Schedule maintenance hourly: `curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/v1/admin/maintenance` (or run `pnpm maintenance`)
6. Configure a real email provider; the `console` provider does not deliver mail in production
7. HTTPS only — Better Auth sets `Secure` cookies when `NODE_ENV=production`

## 3. Security model

- **Identity**: Better Auth sessions (database-backed, 7-day expiry, rolling refresh, revocable). No cookie cache is enabled, so role changes and revocations apply on the next request.
- **Roles**: `participant | admin | super_admin`, stored on the Better Auth user with `input: false` — sign-up and update-user cannot set it (verified: a sign-up carrying `role` is created as `participant`). Only `setUserRole` (super admin, audited, revokes target sessions) or the seed script change roles; the last super admin cannot be demoted.
- **Authorization** is enforced inside services via `assertAdmin/assertParticipant/assertOwnerOrAdmin/assertVerifiedAttendee`; `proxy.ts` and page guards are UX only.
- **CSRF**: mutating `/api/v1` requests must come from a trusted `Origin` (`APP_URL`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`); Server Actions use Next's built-in origin check; Better Auth checks its own.
- **Rate limits** (MongoDB fixed windows, shared across instances): sign-in 5/min, sign-up 20/h, password reset 5/h, attendance-code failures 5 per 15 min per user+event, comments 10/min, media ops, QR scans, reports.
- **QR passes** contain only `GTHR1.<32 random bytes>`. The database stores SHA-256 (lookup) and an AES-GCM ciphertext (so only owner/admin can re-render). Validity is recomputed server-side at every scan: pass active, registration active + payment approved, event not cancelled, correct event, check-in window (6 h before start → 1 h after end).
- **Attendance codes**: ~40-bit human codes, stored as HMAC. Expiry, revocation and max-uses enforced atomically. Shared codes can be forwarded remotely — enable *Code check-ins need staff confirmation* for strict venue attendance.
- **Media**: private bucket, server-generated random keys, 15-minute presigned PUT URLs with signed `Content-Type`/`Content-Length`, completion verifies size + magic bytes (SVG never accepted), images re-decoded by `sharp` and thumbnailed. Every content request — including each video range request — re-runs authorization; private responses are `Cache-Control: private, no-store` + `Vary: Cookie`. Downloads use 60-second presigned URLs issued after the same check.
- **Audit log** (`audit_logs`): event lifecycle, payments (submit/approve/reject/refund), passes, attendance (check-in, rejected scans, failed codes, corrections), media uploads/downloads/moderation/reports, comment/feedback moderation, role changes, maintenance runs.
- CSV exports neutralise spreadsheet formulas; comments/feedback are rendered as text only.

## 4. Transactions and recovery

`MONGODB_TRANSACTIONS=auto` (default) uses transactions when the deployment supports them (Atlas / replica set), otherwise runs the same code without a session. Multi-document units: registration + seat reservation, payment approval + pass issuance, refunds (registration, seat, pass, attendance), check-ins + code usage, moderation + audit.

Without transactions the design stays convergent:
- Seat reservation is a single atomic `$inc` guarded by `registeredCount < capacity`; a failed registration write releases the seat (compensation).
- Unique indexes prevent duplicates: `(eventId,userId)` on registrations, interests, attendances, feedback; `registrationId` and `tokenHash` on passes.
- Approval is idempotent; "approved without pass" is repaired by the next approve call or by maintenance (`reconcileMissingPasses`).
- A duplicate-key race inside a transaction aborts it; `withTransaction` re-runs the unit once, which then observes the winner and returns the idempotent result (verified with concurrent approvals and concurrent QR scans). Units can also `abort(value)` to roll back and return a result.

Use `MONGODB_TRANSACTIONS=required` to fail fast if production should never run without them.

## 5. Media pipeline

1. `POST /api/v1/media/uploads` → auth, attendance/ownership, type/size/quota → pending record + presigned URL (multipart above 64 MB, 16 MB parts)
2. Browser uploads directly to R2 (parts retried individually)
3. `POST /api/v1/media/uploads/{id}/complete` → HEAD size check, signature sniff, `sharp` decode + WebP thumbnail (images), MP4/MOV duration check from the `mvhd` box
4. Gallery items start `pending` moderation unless the event enables auto-approve
5. Maintenance: abandons uploads after 24 h (aborting multipart), fails stuck processing after 1 h, purges failed/deleted/rejected (7 days) objects, deletes orphaned objects and dangling multipart uploads older than 24 h

Attendees can report any visible item ("request removal"); it is hidden immediately and queued for admins.

## 6. Verification performed

- `pnpm typecheck`, `pnpm lint` (0 errors), `pnpm build` — passing.
- Manual end-to-end run of the production build against a throwaway local MongoDB replica set (no R2/email credentials): admin sign-in, event create/validate/publish, sign-up role injection ignored, 401/403 boundaries, cross-origin POST blocked, idempotent interest, capacity limit, duplicate registration, no pass before approval, participant cannot approve, concurrent + repeated approvals → one pass, owner-only QR, QR decoded and scanned (wrong-event rejection, concurrent scans → one check-in), revoked pass rejected, attendance code (wrong/correct/duplicate), gallery locked → unlocked, cross-event and non-attendee denial, refund revokes pass + gallery, comment ownership, feedback eligibility, SVG rejection, CSV export, all pages render.
- Per request, no automated test suite is included in the repository.

## 7. Known limitations

- **R2 and email were not exercised against real services** (no credentials available). Upload, thumbnail, playback and download code paths compile and are wired, but need a real-bucket check after configuration.
- No video transcoding or video thumbnails; originals are streamed as uploaded. WebM duration is not checked (MP4/MOV only, when `mvhd` sits in the first/last 2 MB). Integrate a processing worker if adaptive streaming is needed.
- Payments are manual only — no payment gateway.
- Unpaid registrations hold a seat until the participant or an admin cancels them.
- Event times display in `Asia/Kolkata`; admin date inputs use the browser's timezone and are stored as absolute UTC.
- Without transactions, a concurrent duplicate code check-in can consume one extra code use.
