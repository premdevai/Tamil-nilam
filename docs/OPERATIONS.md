# Operations

## Migrations, including printable reports

Apply every journaled migration with:

```sh
pnpm db:migrate
```

`packages/db/drizzle/meta/_journal.json` includes `0007_printable_reports`.
That file:

- creates `printable_reports` with owner and idempotency indexes
- rebuilds `generated_dprs_idempotency_idx` on `(user_id, idempotency_key)`

If a database already applied `0006_paid_product` and Drizzle believes it is
current, run `pnpm db:migrate` again rather than editing SQL by hand. Only if
the journal and the database disagree, apply the file explicitly against a
**non-production** clone first:

```sh
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f packages/db/drizzle/0007_printable_reports.sql
```

Then confirm `to_regclass('public.printable_reports')` is not null. Do not
invent government facts while backfilling; leave report rows empty until a
user generates one.

## Backups and restore drill

```sh
DATABASE_URL=postgresql://nilam:...@127.0.0.1:5432/nilam \
  ./infrastructure/scripts/backup.sh

DATABASE_URL=postgresql://nilam:...@127.0.0.1:5432/nilam \
RESTORE_DATABASE_URL=postgresql://nilam:...@127.0.0.1:5432/nilam_restore \
  ./infrastructure/scripts/restore-drill.sh
```

Both scripts need `pg_dump` / `psql`. They do not start Docker. Keep
`RESTORE_DATABASE_URL` off the production database.

## Health and smoke

- `GET /api/health` — process liveness, no database
- `GET /api/health/ready` — database ping plus Razorpay lock status

```sh
./infrastructure/scripts/smoke.sh http://127.0.0.1:3000
```

Readiness returning 503 is expected when Postgres is not running. That is a
degraded environment, not a failed web process.

## Secrets and cookies

Production requires `AUTH_SECRET`, `DOWNLOAD_SIGNING_SECRET`, and
`SECRETS_ENCRYPTION_KEY` (32-byte hex) for envelope-encrypted stored secrets.
Session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production
(`__Secure-next-auth.session-token`).

`RAZORPAY_ALLOW_LIVE` must stay unset or `false` outside an approved live
environment.

## Account deletion files

`delete_account` collects `docx_storage_key` / `pdf_storage_key` from
`generated_dprs` and `printable_reports`, unlinks those files under
`DOCUMENT_STORAGE_DIR`, then removes the rows and anonymises the user.

## E2E authentication

`POST /api/e2e/session` exists only when `E2E_AUTH_SECRET` is set (16+
characters) and the request sends the same value in `x-e2e-secret`. Never set
that variable in production Compose.
