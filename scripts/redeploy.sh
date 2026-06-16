#!/usr/bin/env bash
#
# Nucleus — redeploy + full E2E gate.
#
# Run before every E2E test, after any code change. Never run Playwright
# directly against a stale build — the production image must reflect the
# working tree first, otherwise green tests prove nothing.
#
# Usage:
#   scripts/redeploy.sh                # full pipeline
#   scripts/redeploy.sh --skip-build   # skip docker build (image already current)
#   scripts/redeploy.sh --skip-e2e     # deploy only, no Playwright
#   scripts/redeploy.sh --grep step-02 # filter Playwright run
#
# Exit codes:
#   0  — all green
#   1  — typecheck or docker build failed
#   2  — deploy / health probe failed
#   3  — Playwright failed (image is live but specs are red)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NUCLEUS_ENV_FILE="${REPO_ROOT}/.env"
COMPOSE_DIR="/opt/sensu"
COMPOSE_ENV_FILE="${COMPOSE_DIR}/.env"
SERVICE="nucleus-web"
IMAGE="nucleus-web:local"
DOCKERFILE="apps/web/Dockerfile"
WORKER_SERVICE="nucleus-worker"
WORKER_IMAGE="nucleus-worker:local"
WORKER_DOCKERFILE="apps/worker/Dockerfile"
E2E_BASE_URL="${E2E_BASE_URL:-https://app.sensu.com.mx}"

# Source the Nucleus .env on the host so the Playwright run inherits
# E2E_HOOKS_SECRET. The compose file maps env_file: nucleus/.env into the
# container; here we mirror it on the host so tests can call
# /api/dev/last-email with the matching X-E2E-Hook-Secret header.
if [[ -r "$NUCLEUS_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$NUCLEUS_ENV_FILE"
  set +a
fi

# Source the deployment .env so the Playwright run inherits NUCLEUS_*
# values (most importantly E2E_HOOKS_SECRET). The compose file owns the
# NUCLEUS_X → X mapping inside the container; here we mirror it on the
# host so tests can call /api/dev/last-email with the right header.
if [[ -r "$COMPOSE_ENV_FILE" ]]; then
  E2E_HOOKS_SECRET="${E2E_HOOKS_SECRET:-$(sudo grep '^NUCLEUS_E2E_HOOKS_SECRET=' "$COMPOSE_ENV_FILE" | head -1 | cut -d= -f2-)}"
  export E2E_HOOKS_SECRET
fi

SKIP_BUILD=false
SKIP_E2E=false
PLAYWRIGHT_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --skip-e2e)   SKIP_E2E=true;   shift ;;
    --grep)       PLAYWRIGHT_ARGS+=(--grep "$2"); shift 2 ;;
    -h|--help)
      sed -n '2,18p' "$0"; exit 0 ;;
    *) PLAYWRIGHT_ARGS+=("$1"); shift ;;
  esac
done

cyan()   { printf '\033[36m== %s ==\033[0m\n' "$*"; }
green()  { printf '\033[32m✓ %s\033[0m\n' "$*"; }
red()    { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }
yellow() { printf '\033[33m· %s\033[0m\n' "$*"; }

step_total=$([[ "$SKIP_BUILD" = true ]] && echo 5 || echo 7)
[[ "$SKIP_E2E" = true ]] && step_total=$((step_total - 1))
step_n=0

next() { step_n=$((step_n + 1)); cyan "$step_n/$step_total :: $*"; }

cd "$REPO_ROOT"
T0=$(date +%s)

# 1. Workspace install — fast no-op when lockfile unchanged.
next "pnpm install (workspace)"
pnpm install --silent

# 2. Typecheck — fail fast before docker build.
next "typecheck @nucleus/web"
pnpm --filter @nucleus/web typecheck >/dev/null

next "typecheck @nucleus/worker"
pnpm --filter @nucleus/worker typecheck >/dev/null

# 3. Build worker locally so the Step 6 spec can spawn `node apps/worker/dist/index.js`
# against a host-side mosquitto. The redeploy gate is the host-side compile step;
# the worker docker image (built next) bakes the same dist/ separately.
next "compile @nucleus/worker (host dist)"
pnpm --filter @nucleus/worker build >/dev/null

# 4. Docker build (skippable). Builds web + worker images in sequence.
if [[ "$SKIP_BUILD" = false ]]; then
  next "docker build $IMAGE + $WORKER_IMAGE"
  sudo docker build -t "$IMAGE" -f "$DOCKERFILE" . >/tmp/nucleus-redeploy-build.log 2>&1 || {
    red "docker build (web) failed — see /tmp/nucleus-redeploy-build.log"
    tail -25 /tmp/nucleus-redeploy-build.log >&2
    exit 1
  }
  sudo docker build -t "$WORKER_IMAGE" -f "$WORKER_DOCKERFILE" . >/tmp/nucleus-redeploy-worker-build.log 2>&1 || {
    red "docker build (worker) failed — see /tmp/nucleus-redeploy-worker-build.log"
    tail -25 /tmp/nucleus-redeploy-worker-build.log >&2
    exit 1
  }
fi

# 5. Compose up + health probe (web + worker).
next "compose up + health probe"
( cd "$COMPOSE_DIR" && sudo docker compose --env-file "$COMPOSE_ENV_FILE" up -d "$SERVICE" "$WORKER_SERVICE" ) >/dev/null

# Wait up to 60s for the container's healthcheck to flip to "healthy".
for i in $(seq 1 60); do
  status=$(sudo docker inspect --format '{{.State.Health.Status}}' "$SERVICE" 2>/dev/null || echo missing)
  [[ "$status" == "healthy" ]] && break
  sleep 1
done
if [[ "$status" != "healthy" ]]; then
  red "container $SERVICE not healthy after 60s (status=$status)"
  sudo docker logs --tail 40 "$SERVICE" >&2 || true
  exit 2
fi
yellow "container healthy"

# Reload nginx so it re-resolves the nucleus-web container IP after a recreate.
# nginx caches the upstream IP at proxy_pass parse time; without this reload
# CloudFront sees a 502 until the next config reload.
sudo docker exec sensu-nginx nginx -s reload >/dev/null 2>&1 || true

# Hit /healthz through CloudFront — proves the full chain (DNS → CF → nginx → app).
# Retry up to 12s; CloudFront can cache the 502 it observed pre-reload and serve
# it for a beat after nginx flips, even though the upstream is already healthy.
healthz=000
for _ in $(seq 1 12); do
  healthz=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$E2E_BASE_URL/healthz" || echo 000)
  [[ "$healthz" == "200" ]] && break
  sleep 1
done
if [[ "$healthz" != "200" ]]; then
  red "smoke probe failed: $E2E_BASE_URL/healthz HTTP=$healthz"
  exit 2
fi
yellow "smoke ok :: $E2E_BASE_URL/healthz → 200 via CloudFront"

# Worker has no HTTP healthcheck — confirm the container is at least running.
worker_state=$(sudo docker inspect --format '{{.State.Status}}' "$WORKER_SERVICE" 2>/dev/null || echo missing)
if [[ "$worker_state" != "running" ]]; then
  red "container $WORKER_SERVICE not running (state=$worker_state)"
  sudo docker logs --tail 40 "$WORKER_SERVICE" >&2 || true
  exit 2
fi
yellow "worker running :: $WORKER_SERVICE"

# 6. Seed the canonical demo fixture (idempotent). Runs against the live
# image so Playwright — and Juan — hit a populated, deterministic state.
yellow "seeding demo fixture"
E2E_BASE_URL="$E2E_BASE_URL" bash "$SCRIPT_DIR/seed-e2e.sh"

# 7. Playwright (skippable).
if [[ "$SKIP_E2E" = false ]]; then
  next "playwright e2e"
  if ! E2E_BASE_URL="$E2E_BASE_URL" pnpm --filter @nucleus/e2e exec playwright test "${PLAYWRIGHT_ARGS[@]}"; then
    red "Playwright failed — image is live but specs are red"
    exit 3
  fi
fi

T1=$(date +%s)
green "all green ($((T1 - T0))s, base=$E2E_BASE_URL)"
