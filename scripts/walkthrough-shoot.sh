#!/usr/bin/env bash
#
# Nucleus — refresh the marketing walkthrough screenshots.
#
# Runs ONLY the walkthrough-shoot.spec.ts file, which re-captures every
# image embedded in `overview/Sensu — Phase A Acceptance Walkthrough.pdf`.
# Detached from `scripts/redeploy.sh` because the shoot adds ~3 minutes
# per run and the screenshots only need to be refreshed when the
# marketing PDF itself is being regenerated.
#
# Usage:
#   scripts/walkthrough-shoot.sh                     # default base URL
#   E2E_BASE_URL=http://127.0.0.1:3000 scripts/walkthrough-shoot.sh
#
# The script sources the repo .env so the same E2E_HOOKS_SECRET and
# NUCLEUS_*_PASSWORD vars the redeploy uses are available.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"

if [[ -r "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

E2E_BASE_URL="${E2E_BASE_URL:-https://app.sensu.com.mx}"

cd "$REPO_ROOT"
echo "shooting walkthrough against $E2E_BASE_URL"
# NUCLEUS_INCLUDE_SHOOT re-enables walkthrough-shoot.spec.ts (default
# testIgnore in playwright.config.ts hides it). The positional arg is
# the file path so we only run that one file, not the whole suite.
NUCLEUS_INCLUDE_SHOOT=1 E2E_BASE_URL="$E2E_BASE_URL" \
  pnpm --filter @nucleus/e2e exec playwright test \
  specs/walkthrough-shoot.spec.ts "$@"
