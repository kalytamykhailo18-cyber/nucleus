#!/usr/bin/env bash
#
# Nucleus — validate-then-deploy.
#
# Flow:
#   1. typecheck (web + worker)
#   2. host-compile @nucleus/worker (Step 6 spec spawns it directly)
#   3. docker build → tag images :test
#   4. spin up isolated test stack (postgres + web + worker on host
#      ports 13xxx, brand-new tmpfs postgres, RESEND_MODE=dev so no
#      mail leaves the box no matter what the suite triggers)
#   5. apply Prisma schema to the test postgres + snapshot the Plan
#      catalogue from prod (read-only catalog data — no PII)
#   6. seed the canonical demo fixture against the test stack
#   7. run Playwright against http://127.0.0.1:13001 (workers=4,
#      retries=1 from playwright.config.ts)
#   8. ONLY IF the suite is green:
#      - retag images :test → :local
#      - replace the prod containers via /opt/sensu/docker-compose.yml
#      - probe /healthz through CloudFront
#      - reload nginx upstream cache
#   9. ALWAYS tear down the test stack on exit (trap)
#
# Pre-2026-06-17 this script deployed first and tested second, against
# the prod URL. The suite running against prod meant a 13-minute window
# where real customers saw whatever the new image did, with workers=4
# spec parallelism hitting prod alongside them. The new order: prod
# is never touched until the suite passes on an isolated copy.
#
# Usage:
#   scripts/redeploy.sh                # full pipeline (build + test + deploy)
#   scripts/redeploy.sh --skip-build   # reuse already-built :test images
#   scripts/redeploy.sh --skip-e2e     # deploy without running the suite
#                                      # (emergency hot-fix; use sparingly)
#   scripts/redeploy.sh --grep step-02 # filter Playwright run
#   scripts/redeploy.sh --shoot        # include walkthrough-shoot.spec.ts
#
# Exit codes:
#   0 — all green, prod is on the new image
#   1 — typecheck or docker build failed; prod untouched
#   2 — test stack failed to come up; prod untouched
#   3 — Playwright failed; prod untouched
#   4 — prod deploy / health probe failed (image built and tested, but
#       compose up against /opt/sensu rolled back unhealthy)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
NUCLEUS_ENV_FILE="${REPO_ROOT}/.env"
COMPOSE_DIR="/opt/sensu"
COMPOSE_ENV_FILE="${COMPOSE_DIR}/.env"

SERVICE="nucleus-web"
WORKER_SERVICE="nucleus-worker"
DOCKERFILE="apps/web/Dockerfile"
WORKER_DOCKERFILE="apps/worker/Dockerfile"

# Image tags. We build under :test, retag to :local only after the
# suite passes — that retag is what makes the prod compose pick up the
# new image on the next `up -d`.
IMAGE_TEST="nucleus-web:test"
IMAGE_LOCAL="nucleus-web:local"
WORKER_IMAGE_TEST="nucleus-worker:test"
WORKER_IMAGE_LOCAL="nucleus-worker:local"

# Test stack — isolated from prod on every axis (different project
# name, different container names, different host ports, different
# database, RESEND_MODE=dev).
TEST_PROJECT="sensu-test"
TEST_COMPOSE_FILE="${REPO_ROOT}/infra/compose-test.yml"
TEST_POSTGRES_HOST_PORT=13432
TEST_WEB_HOST_PORT=13001
TEST_BASE_URL="http://127.0.0.1:${TEST_WEB_HOST_PORT}"
TEST_DB_URL="postgresql://sensu:testpw@127.0.0.1:${TEST_POSTGRES_HOST_PORT}/sensu_pay_test"

PROD_BASE_URL="${E2E_BASE_URL:-https://app.sensu.com.mx}"

# Source the Nucleus .env for E2E_HOOKS_SECRET so the seed script and
# spec hooks can read it on the host. The compose files map it into
# both prod and test containers separately.
if [[ -r "$NUCLEUS_ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$NUCLEUS_ENV_FILE"
  set +a
fi

# Pull NUCLEUS_E2E_HOOKS_SECRET from /opt/sensu/.env as a fallback —
# this is the canonical secret prod compose uses.
if [[ -r "$COMPOSE_ENV_FILE" ]]; then
  E2E_HOOKS_SECRET="${E2E_HOOKS_SECRET:-$(sudo grep '^NUCLEUS_E2E_HOOKS_SECRET=' "$COMPOSE_ENV_FILE" | head -1 | cut -d= -f2-)}"
  export E2E_HOOKS_SECRET
fi

SKIP_BUILD=false
SKIP_E2E=false
RUN_SHOOT=false
# --isolated runs the new validate-then-deploy flow: build + spin
# up the test stack on http://127.0.0.1:13001 + suite against THAT
# + deploy-if-green. Default behavior is the legacy flow (build +
# deploy + suite against the live prod URL), kept because ~19 specs
# are still coupled to prod seed state (Medtronic company,
# demo+esencial subscriptions, EviewEvent history). Migrate those
# to seed-e2e.sh, then `--isolated` becomes the default.
ISOLATED=false
PLAYWRIGHT_ARGS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=true; shift ;;
    --skip-e2e)   SKIP_E2E=true;   shift ;;
    --shoot)      RUN_SHOOT=true;  shift ;;
    --isolated)   ISOLATED=true;   shift ;;
    --grep)       PLAYWRIGHT_ARGS+=(--grep "$2"); shift 2 ;;
    -h|--help)    sed -n '2,60p' "$0"; exit 0 ;;
    *) PLAYWRIGHT_ARGS+=("$1"); shift ;;
  esac
done

if [[ "$RUN_SHOOT" = true ]]; then
  export NUCLEUS_INCLUDE_SHOOT=1
fi

cyan()   { printf '\033[36m== %s ==\033[0m\n' "$*"; }
green()  { printf '\033[32m✓ %s\033[0m\n' "$*"; }
red()    { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; }
yellow() { printf '\033[33m· %s\033[0m\n' "$*"; }

# Tear-down trap — always runs, even on Ctrl-C / kill / exit code != 0.
# Stops + removes the test stack so a half-started stack can't linger
# and steal memory or block the next run.
TEST_STACK_UP=false
teardown_test_stack() {
  if [[ "$TEST_STACK_UP" = true ]]; then
    yellow "tearing down test stack"
    sudo docker compose -p "$TEST_PROJECT" -f "$TEST_COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
    TEST_STACK_UP=false
  fi
}
trap teardown_test_stack EXIT INT TERM

cd "$REPO_ROOT"
T0=$(date +%s)
step_n=0
next() { step_n=$((step_n + 1)); cyan "$step_n :: $*"; }

# ─────────────────────────────────────────────────────────────────────
# Stage 1 — host-side validation
# ─────────────────────────────────────────────────────────────────────
next "pnpm install (workspace)"
pnpm install --silent

next "typecheck @nucleus/web"
pnpm --filter @nucleus/web typecheck >/dev/null

next "typecheck @nucleus/worker"
pnpm --filter @nucleus/worker typecheck >/dev/null

next "compile @nucleus/worker (host dist for Step 6 spec)"
pnpm --filter @nucleus/worker build >/dev/null

# ─────────────────────────────────────────────────────────────────────
# Stage 2 — docker build (tagged :test until the suite proves it green)
# ─────────────────────────────────────────────────────────────────────
if [[ "$SKIP_BUILD" = false ]]; then
  next "docker build $IMAGE_TEST + $WORKER_IMAGE_TEST"
  sudo docker build -t "$IMAGE_TEST" -f "$DOCKERFILE" . >/tmp/nucleus-redeploy-build.log 2>&1 || {
    red "docker build (web) failed — see /tmp/nucleus-redeploy-build.log"
    tail -25 /tmp/nucleus-redeploy-build.log >&2
    exit 1
  }
  sudo docker build -t "$WORKER_IMAGE_TEST" -f "$WORKER_DOCKERFILE" . >/tmp/nucleus-redeploy-worker-build.log 2>&1 || {
    red "docker build (worker) failed — see /tmp/nucleus-redeploy-worker-build.log"
    tail -25 /tmp/nucleus-redeploy-worker-build.log >&2
    exit 1
  }
fi

# ─────────────────────────────────────────────────────────────────────
# Stage 3 — Emergency path: --skip-e2e deploys without testing.
# ─────────────────────────────────────────────────────────────────────
deploy_to_prod() {
  next "retag :test → :local"
  sudo docker tag "$IMAGE_TEST" "$IMAGE_LOCAL"
  sudo docker tag "$WORKER_IMAGE_TEST" "$WORKER_IMAGE_LOCAL"

  next "compose up (prod) + health probe"
  ( cd "$COMPOSE_DIR" && sudo docker compose --env-file "$COMPOSE_ENV_FILE" up -d "$SERVICE" "$WORKER_SERVICE" ) >/dev/null

  for _ in $(seq 1 60); do
    status=$(sudo docker inspect --format '{{.State.Health.Status}}' "$SERVICE" 2>/dev/null || echo missing)
    [[ "$status" == "healthy" ]] && break
    sleep 1
  done
  if [[ "$status" != "healthy" ]]; then
    red "container $SERVICE not healthy after 60s (status=$status)"
    sudo docker logs --tail 40 "$SERVICE" >&2 || true
    exit 4
  fi
  yellow "container healthy"

  sudo docker exec sensu-nginx nginx -s reload >/dev/null 2>&1 || true

  healthz=000
  for _ in $(seq 1 12); do
    healthz=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$PROD_BASE_URL/healthz" || echo 000)
    [[ "$healthz" == "200" ]] && break
    sleep 1
  done
  if [[ "$healthz" != "200" ]]; then
    red "smoke probe failed: $PROD_BASE_URL/healthz HTTP=$healthz"
    exit 4
  fi
  yellow "smoke ok :: $PROD_BASE_URL/healthz → 200 via CloudFront"

  # Stripe webhook smoke probe (Juan / Ustym 2026-06-19). On 2026-06-09
  # the prod CloudFront cached a stale 301 at /api/stripe/webhook and
  # Stripe disabled the endpoint after 9 days of silent failures.
  # Probe with a bogus stripe-signature header — the route should
  # return 400 (invalid signature, the handler's first branch). 301,
  # 5xx, or anything else means we are about to ship a broken
  # webhook surface. We exit before flipping the prod compose if so.
  wh_probe=000
  for _ in $(seq 1 6); do
    wh_probe=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \
      -X POST -H 'stripe-signature: t=0,v1=smoke-probe' \
      "$PROD_BASE_URL/api/stripe/webhook" || echo 000)
    [[ "$wh_probe" == "400" ]] && break
    sleep 1
  done
  if [[ "$wh_probe" != "400" ]]; then
    red "Stripe webhook smoke probe failed: HTTP=$wh_probe (expected 400)"
    exit 4
  fi
  yellow "smoke ok :: $PROD_BASE_URL/api/stripe/webhook → 400 invalid-sig"

  worker_state=$(sudo docker inspect --format '{{.State.Status}}' "$WORKER_SERVICE" 2>/dev/null || echo missing)
  if [[ "$worker_state" != "running" ]]; then
    red "container $WORKER_SERVICE not running (state=$worker_state)"
    sudo docker logs --tail 40 "$WORKER_SERVICE" >&2 || true
    exit 4
  fi
  yellow "worker running :: $WORKER_SERVICE"
}

if [[ "$SKIP_E2E" = true ]]; then
  yellow "WARNING: --skip-e2e — deploying without test stack validation"
  deploy_to_prod
  T1=$(date +%s)
  green "deployed without test ($((T1 - T0))s)"
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────
# Default flow: legacy "build + deploy + suite against prod URL".
# ─────────────────────────────────────────────────────────────────────
if [[ "$ISOLATED" = false ]]; then
  deploy_to_prod

  # 2026-07-01 (Juan): the demo+esencial subscriptions in prod DB
  # carry a static currentPeriodEnd from whenever they were last
  # seeded, which drifts closer to "today" over time. dashboard-
  # subscription.spec asserts renewal is ~1 month out; if the seed
  # is 14 days stale the test flakes. Refresh both rows before
  # Playwright so the renewal-date assertions stay deterministic.
  next "refresh prod demo seeds (renewal dates)"
  # E2E_HOOKS_SECRET lives in the nucleus repo .env (not /opt/sensu/.env
  # which uses NUCLEUS_E2E_HOOKS_SECRET). The nucleus repo .env is what
  # the container reads via env_file: in compose.
  REPO_ENV_FILE="$REPO_ROOT/.env"
  E2E_SECRET=$(grep '^E2E_HOOKS_SECRET' "$REPO_ENV_FILE" | cut -d= -f2- | tr -d '"')
  for cadence_pair in "1:MONTHLY:0101" "2:ANNUAL:0102"; do
    IFS=':' read -r suffix cadence phone_suffix <<< "$cadence_pair"
    curl -s -o /dev/null -X POST "$PROD_BASE_URL/api/dev/seed-registration" \
      -H "x-e2e-hook-secret: $E2E_SECRET" \
      -H "Content-Type: application/json" \
      -d "{\"email\":\"demo+esencial-${suffix}@sensu.com.mx\",\"password\":\"Sensu-Reg-2026!\",\"fullName\":\"Esencial Family ${suffix}\",\"phone\":\"+52 55 0000 ${phone_suffix}\",\"planType\":\"ANGELA_ESENCIAL\",\"status\":\"ACTIVE\",\"cadence\":\"${cadence}\"}"
  done
  yellow "prod demo seeds refreshed"

  next "playwright @ $PROD_BASE_URL"
  if ! E2E_BASE_URL="$PROD_BASE_URL" pnpm --filter @nucleus/e2e exec playwright test "${PLAYWRIGHT_ARGS[@]}"; then
    red "Playwright failed — image is live but specs are red"
    exit 3
  fi
  T1=$(date +%s)
  green "all green ($((T1 - T0))s, base=$PROD_BASE_URL)"
  exit 0
fi

# ─────────────────────────────────────────────────────────────────────
# Stage 4 — spin up the isolated test stack
# ─────────────────────────────────────────────────────────────────────
next "test stack up (project=$TEST_PROJECT)"
TEST_STACK_UP=true
sudo docker compose -p "$TEST_PROJECT" -f "$TEST_COMPOSE_FILE" up -d postgres-test >/dev/null

# Wait for postgres-test healthy before pushing schema.
for _ in $(seq 1 30); do
  pg_status=$(sudo docker inspect --format '{{.State.Health.Status}}' sensu-postgres-test 2>/dev/null || echo missing)
  [[ "$pg_status" == "healthy" ]] && break
  sleep 1
done
if [[ "$pg_status" != "healthy" ]]; then
  red "test postgres not healthy after 30s (status=$pg_status)"
  exit 2
fi
yellow "postgres-test healthy"

# Push the Prisma schema into the empty test database.
next "prisma db push → test postgres"
DATABASE_URL="$TEST_DB_URL" pnpm --filter @nucleus/web exec prisma db push \
  --skip-generate --accept-data-loss >/dev/null

# Snapshot the Plan catalogue from prod into the test database. Plan
# rows carry Stripe price IDs the checkout specs need; everything else
# (users / subscriptions / events) is seed-generated below. Plans are
# pure catalog data — no PII, no customer rows — so cloning them is
# safe and gives the test stack the same payment surface prod hits.
next "Plan catalog ← prod (Stripe price IDs)"
sudo docker exec sensu-postgres pg_dump -U sensu -t '"Plan"' --data-only --no-owner sensu_pay 2>/dev/null \
  | sudo docker exec -i sensu-postgres-test psql -U sensu -d sensu_pay_test >/dev/null 2>&1 || {
  red "Plan catalog snapshot failed"
  exit 2
}

# Now bring up the web + worker containers.
next "web + worker up + health probe"
sudo docker compose -p "$TEST_PROJECT" -f "$TEST_COMPOSE_FILE" up -d nucleus-web-test nucleus-worker-test >/dev/null

for _ in $(seq 1 60); do
  web_status=$(sudo docker inspect --format '{{.State.Health.Status}}' nucleus-web-test 2>/dev/null || echo missing)
  [[ "$web_status" == "healthy" ]] && break
  sleep 1
done
if [[ "$web_status" != "healthy" ]]; then
  red "nucleus-web-test not healthy after 60s (status=$web_status)"
  sudo docker logs --tail 40 nucleus-web-test >&2 || true
  exit 2
fi
yellow "test web healthy :: $TEST_BASE_URL"

# ─────────────────────────────────────────────────────────────────────
# Stage 5 — seed test stack + run suite
# ─────────────────────────────────────────────────────────────────────
next "seed demo fixture → test stack"
E2E_BASE_URL="$TEST_BASE_URL" bash "$SCRIPT_DIR/seed-e2e.sh" >/dev/null

next "playwright @ $TEST_BASE_URL"
# Override DATABASE_URL so the few specs that spawn their own worker
# process (step-06, step-06b) connect to the test postgres instead of
# the prod one. Those workers read DATABASE_URL from process.env and
# rewrite `@postgres:` → `@127.0.0.1:` for host access; pointing at
# 127.0.0.1:13432 directly skips the rewrite and hits the isolated
# test database.
if ! \
  E2E_BASE_URL="$TEST_BASE_URL" \
  DATABASE_URL="$TEST_DB_URL" \
  pnpm --filter @nucleus/e2e exec playwright test "${PLAYWRIGHT_ARGS[@]}"; then
  red "Playwright failed — prod stays on the previous image"
  exit 3
fi

# ─────────────────────────────────────────────────────────────────────
# Stage 6 — suite green → deploy to prod
# ─────────────────────────────────────────────────────────────────────
deploy_to_prod

T1=$(date +%s)
green "all green ($((T1 - T0))s, prod=$PROD_BASE_URL, tested=$TEST_BASE_URL)"
