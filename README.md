# AfterHours — event management platform

Meetup-style event platform built as a Next.js modular monolith: public discovery, participant registration with **manual payment verification**, **QR passes** issued only after approval, staff QR scanning / shared attendance codes, and **private photo & video galleries** (Cloudflare R2) unlocked per event by verified attendance.

Stack: Next.js 16 (App Router, Cache Components) · React 19 · TypeScript strict · MongoDB + Mongoose · Better Auth (MongoDB adapter) · Zod · Cloudflare R2 via AWS SDK v3 · `qrcode` · `@yudiel/react-qr-scanner` · pnpm.

## Quick start

```bash
pnpm install
cp .env.example .env          # fill MONGODB_URI, BETTER_AUTH_SECRET, BETTER_AUTH_URL, APP_URL
pnpm db:indexes               # create MongoDB indexes (run on every deploy)
pnpm seed:admin               # first super admin (env vars or interactive prompt)
pnpm dev
```

- Participants: `/register`, `/login` → `/dashboard`, `/my-events`, `/my-passes`, `/my-gallery`, `/profile`
- Organizers: `/admin/login` → `/admin/dashboard` and the admin console
- Media uploads require R2 settings plus `pnpm r2:cors` once per bucket.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm dev` / `build` / `start` | Next.js |
| `pnpm lint` / `pnpm typecheck` | ESLint / `tsc --noEmit` |
| `pnpm db:indexes` | Create all indexes (non-destructive) |
| `pnpm seed:admin` | Provision or promote the first `super_admin` |
| `pnpm maintenance` | Idempotent job: pass reconciliation, auto-complete ended events, reminders, email retries, R2 cleanup |
| `pnpm r2:cors` | Apply the R2 CORS policy for direct browser uploads |

## Architecture

```
Route Handler (src/app/api/v1/**) ─┐
Server Action (src/actions/*)  ────┴─> session (lib/auth-guards) -> Zod -> service (modules/*/x.service.ts)
                                         -> repository / Mongoose model -> MongoDB
```

- `src/modules/<domain>`: `*.model.ts` (Mongoose, UUID v7 `_id`), `*.policy.ts` (pure rules: state machines, access), `*.service.ts` (business logic; **every service re-asserts the actor's role**), DTO mappers.
- `src/lib`: env (Zod, lazy), db, auth (Better Auth), guards, transactions, rate limiting (MongoDB-backed), errors, pagination, crypto.
- `src/infrastructure`: R2 storage abstraction + file-signature validation, email provider abstraction.
- Route Handlers and Server Actions are thin and call the same services.

API errors share one shape: `{ "error": { "code", "message", "reason?", "fieldErrors?" } }`; successes return `{ "data": … }`.

See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)** for configuration, security model, transactions/recovery, media pipeline and known limitations.
