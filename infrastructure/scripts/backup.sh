#!/usr/bin/env bash
set -euo pipefail

# Logical backup of the application database. Does not require Docker.
# Usage: DATABASE_URL=postgresql://... ./infrastructure/scripts/backup.sh [output.sql]

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is not installed. Install PostgreSQL client tools or run this on the database host." >&2
  exit 1
fi

output="${1:-.data/backups/nilam-$(date -u +%Y%m%dT%H%M%SZ).sql}"
mkdir -p "$(dirname "$output")"
pg_dump --no-owner --no-acl --format=plain --file="$output" "$DATABASE_URL"
echo "Wrote $output"
