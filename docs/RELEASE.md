# Incremental release gates

Each stage below is a go/no-go. Later stages reuse every earlier gate. Live
Razorpay stays locked (`RAZORPAY_ALLOW_LIVE` is not `true`) until an approved
production environment is reviewed separately.

## Shared gates

Required for every stage:

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`
- Engine golden fixtures and citation invariants pass
- `node scripts/check-js-budget.mjs` after a production web build
- `pnpm test:e2e` for Matcher, sharing, and any authenticated flows the
  environment can support
- `infrastructure/scripts/backup.sh` has produced a restoreable dump
- `infrastructure/scripts/restore-drill.sh` has been run against a disposable
  database
- `infrastructure/scripts/smoke.sh <origin>` is green, including
  `checks.razorpayLiveLocked: true`

CI runs the software gates. Backup/restore proof is an operator sign-off
because it needs a live Postgres that this repository does not start.

## Stage 1 — Internal data-ops console

- Staging-only connectors, human review, and append-only publish path
- Scraper role still cannot write `publication_versions`
- `0007_printable_reports` is present in the migration journal even if Pro
  reports are unused

## Stage 2 — Public free product

- Matcher, encyclopedia, land fallback, playbooks, and share cards
- No displayed rupee amount without a citation and `verified_on`
- Land explorer lazy-loads MapLibre and skips tiles on `saveData` / 2G

## Stage 3 — Authenticated alerts

- Magic-link login, Telegram linking, saved stacks, and delivery preferences
- Account deletion removes generated DPR/report files, then anonymises the user

## Stage 4 — Paid DPR beta

- `PAYMENT_GATEWAY_MODE=fake` until Razorpay is explicitly unlocked
- Checkout, webhook replay, signed downloads, and DPR job idempotency pass
- Playwright purchase + DPR queue succeeds with the fake gateway

## Stage 5 — Pro / consultant

- Printable reports, bulk runs, consultant workspaces
- Apply `packages/db/drizzle/0007_printable_reports.sql` before enabling the
  Pro report UI against an existing database

## Honest operational blockers

- **PostGIS:** `/api/land` falls back to “availability unknown” when Postgres
  is down or `ST_*` is unavailable. Live plot polygons need PostgreSQL 16 +
  PostGIS, typically via Compose or a hosted instance. Tests and CI do not
  require a local Docker daemon.
- **Python TLS:** data-ops live fetches are HTTPS-only to allowlisted hosts and
  use the default certificate store. Fixture tests do not need the network.
  Live government portals can still fail in minimal container CA bundles; keep
  using fixtures until the operator confirms `httpx` verifies those hosts.
- **Docker:** `docker compose config` validates the file. Starting the stack
  is optional. Quality and E2E CI use GitHub service containers, not
  `docker compose up`.
