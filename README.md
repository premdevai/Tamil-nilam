# NILAM

Tamil Nadu-first industrial land and scheme platform. The workspace now
includes the verified public product, accounts/alerts, paid DPR/Pro paths, and
the hardening gates. Live Razorpay stays locked.

## Workspace

- `apps/web` — Next.js App Router site and synchronous API routes
- `apps/worker` — Graphile Worker process for background jobs
- `packages/db` — Drizzle/PostGIS schema, migrations, invariants, and seeds
- `packages/engine` — pure TypeScript rule engine
- `packages/paid` — entitlements, DPR math, and deterministic documents
- `packages/ui` — NILAM paper/ink design tokens and shared primitives
- `services/dataops` — Python staging-only ingestion tooling
- `services/tgbot` — Telegram delivery process boundary

The PRD, TDD, and prototype-review directory are source material and remain
unchanged.

## Local setup

1. Install Node.js 22+ and enable Corepack.
2. Run `pnpm install`.
3. Copy `.env.example` to `.env` and replace the development secrets.
4. If Docker is available: `docker compose up -d postgres meilisearch`.
   Quality, unit, and most E2E tests do not require a Docker daemon.
5. When Postgres is running: `pnpm db:migrate && pnpm db:seed`.
   Existing databases must apply `0007_printable_reports` before Pro reports.
6. Run `pnpm dev`.

Deploy one Vercel project from this repo. That ships `apps/web` — the Next.js
UI and its API routes. `services/dataops` is a local Python ingest CLI, and
`apps/worker` is an optional background process; neither belongs on Vercel.

The web liveness endpoint is `/api/health`. Readiness (`/api/health/ready`)
also pings the database. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`,
`pnpm build`, and `pnpm test:e2e` before opening a pull request.

Authenticated Playwright flows (login, Telegram, fake-gateway purchase, DPR
queue, admin review) run only when `E2E_AUTH_SECRET` and Postgres are set.
Without them the public Matcher/share/login-page tests still run.

For the full container stack, run `docker compose up --build`. Caddy serves the
web app at `https://localhost` with a local certificate.

Release gates, backup/restore drills, and remaining PostGIS/Python TLS
blockers are in [docs/RELEASE.md](docs/RELEASE.md) and
[docs/OPERATIONS.md](docs/OPERATIONS.md).
