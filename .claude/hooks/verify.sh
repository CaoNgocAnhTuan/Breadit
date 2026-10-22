#!/usr/bin/env bash
# Runs the project checks and prints one line per check. Used by /verify and /implement.
#
# Usage: bash .claude/hooks/verify.sh [--quick] [--it|--no-it]
#   --quick   shared build, frontend typecheck and backend unit tests only
#   --it      run the integration tests even if db and redis look down
#   --no-it   skip the integration tests
# Exit code: 0 when every check that ran passed.

set -u
ROOT=$(git rev-parse --show-toplevel) || exit 2
cd "$ROOT" || exit 2

QUICK=0
IT=auto
for a in "$@"; do
  case "$a" in
    --quick) QUICK=1 ;;
    --it) IT=yes ;;
    --no-it) IT=no ;;
    *) echo "unknown option: $a"; exit 2 ;;
  esac
done

LOGDIR=$(mktemp -d "${TMPDIR:-/tmp}/breadit-verify.XXXXXX")
FAILED=0
SUMMARY=()

step() {
  local name=$1
  shift
  local log="$LOGDIR/$(echo "$name" | tr ' /' '__').log"
  local start=$SECONDS
  echo "running: $name"
  if "$@" >"$log" 2>&1; then
    SUMMARY+=("PASS  $name ($((SECONDS - start))s) $(grep -E '^Tests:' "$log" | tail -n 1)")
  else
    FAILED=1
    SUMMARY+=("FAIL  $name ($((SECONDS - start))s) $(grep -E '^Tests:' "$log" | tail -n 1)  log: $log")
    echo "---- $name failed. Last 30 lines:"
    tail -n 30 "$log"
    echo "----"
  fi
}
skip() { SUMMARY+=("SKIP  $1"); }

step "shared build" npm run build -w @breadit/shared
step "frontend typecheck" npm run typecheck
if [ "$QUICK" = 0 ]; then
  step "frontend lint" npm run lint
  step "backend build" npm run build -w @breadit/backend
else
  skip "frontend lint (--quick)"
  skip "backend build (--quick)"
fi
step "backend unit tests" npm run test -w @breadit/backend

if [ "$QUICK" = 1 ] || [ "$IT" = no ]; then
  skip "integration tests"
else
  UP=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -cE '(^|[-_])(db|redis)([-_][0-9]+)?$' || true)
  if [ "$IT" = yes ] || [ "${UP:-0}" -ge 2 ]; then
    step "integration tests" npm run test:it -w @breadit/backend
  else
    skip "integration tests (db and redis are not running: docker compose up db redis -d)"
  fi
fi

if [ -f eval/package.json ] && node -e 'process.exit(require("./eval/package.json").scripts?.verify ? 0 : 1)' 2>/dev/null; then
  step "eval verify" npm run verify -w @breadit/eval
else
  skip "eval verify (no eval workspace with a verify script yet)"
fi

echo
echo "== verify summary =="
printf '%s\n' "${SUMMARY[@]}"
echo "logs: $LOGDIR"
exit "$FAILED"
