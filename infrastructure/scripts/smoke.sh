#!/usr/bin/env bash
set -euo pipefail

# Production-shaped smoke checks. Works against any reachable origin.
# Usage: ./infrastructure/scripts/smoke.sh [https://localhost]

base="${1:-${SMOKE_BASE_URL:-http://127.0.0.1:3000}}"

fail() {
  echo "smoke failed: $1" >&2
  exit 1
}

code="$(curl -sS -o /tmp/nilam-smoke-health.json -w '%{http_code}' "$base/api/health" || true)"
[[ "$code" == "200" ]] || fail "liveness returned $code"
python3 - <<'PY'
import json
body = json.load(open("/tmp/nilam-smoke-health.json"))
assert body.get("service") == "nilam-web"
assert body.get("status") == "ok"
PY

ready_code="$(curl -sS -o /tmp/nilam-smoke-ready.json -w '%{http_code}' "$base/api/health/ready" || true)"
python3 - <<PY
import json
body = json.load(open("/tmp/nilam-smoke-ready.json"))
print("readiness", ${ready_code}, body)
assert body.get("checks", {}).get("razorpayLiveLocked") is True
PY

matcher_code="$(curl -sS -o /dev/null -w '%{http_code}' "$base/")"
[[ "$matcher_code" == "200" ]] || fail "matcher returned $matcher_code"

echo "smoke passed against $base (readiness HTTP $ready_code)"
