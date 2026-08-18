#!/usr/bin/env bash
# scripts/test-integration.sh — live tier, persists full output.
set -euo pipefail
log="integration-results/$(date +%Y-%m-%dT%H.%M.%S).log"
mkdir -p "$(dirname "$log")"
echo "integration run → $log"
HOST_INTEGRATION=1 npx vitest run "$@" 2>&1 | tee "$log"
