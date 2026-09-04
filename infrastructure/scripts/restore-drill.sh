#!/usr/bin/env bash
set -euo pipefail

# Restore drill against a disposable database. Does not require Docker.
# Usage:
#   DATABASE_URL=postgresql://... \
#   RESTORE_DATABASE_URL=postgresql://.../nilam_restore \
#   ./infrastructure/scripts/restore-drill.sh [backup.sql]

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required for the source dump" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
  echo "pg_dump and psql are required. This drill does not start Postgres for you." >&2
  exit 1
fi

dump="${1:-}"
if [[ -z "$dump" ]]; then
  dump="$(mktemp "${TMPDIR:-/tmp}/nilam-restore.XXXXXX.sql")"
  trap 'rm -f "$dump"' EXIT
  pg_dump --no-owner --no-acl --format=plain --file="$dump" "$DATABASE_URL"
fi

target="${RESTORE_DATABASE_URL:-}"
if [[ -z "$target" ]]; then
  echo "RESTORE_DATABASE_URL is required. Point it at an empty disposable database, never production." >&2
  exit 1
fi

if [[ "$target" == "$DATABASE_URL" ]]; then
  echo "RESTORE_DATABASE_URL must differ from DATABASE_URL" >&2
  exit 1
fi

psql --quiet --set ON_ERROR_STOP=1 "$target" -c "select current_database();"
psql --quiet --set ON_ERROR_STOP=1 "$target" -f "$dump"
psql --quiet --set ON_ERROR_STOP=1 "$target" -c "select to_regclass('public.printable_reports') as printable_reports;"
echo "Restore drill succeeded against $target"
