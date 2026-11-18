#!/usr/bin/env bash
# P8 check (DW6): `npm run thesis:repro` on a clean clone of test-app gives exit 0 and leaves `git status --short` empty.
# Style of .docs/works/2026-10-28-p0-baseline-freeze/check_clean_clone.sh.
#
# Usage: bash .docs/works/2026-11-18-p8-repro/check_clean_clone.sh [--keep]
#   --keep   do not remove the clone at the end (to look at eval/results/repro/*.log after a failure)
# Needs: Node from .nvmrc (nvm use), docker compose up db redis -d, the two Digg zips in datasets/raw/digg2009/ of this repo, network
# for `npm ci`. It takes about 3 hours: it runs the whole repro command under `caffeinate -i` (a sleeping Mac would stop it).
# It clones the committed test-app branch of this repo: commit first, uncommitted files are not in the clone.
# The clone uses the same eval_load schema and Redis database 2 as the dev machine, so nothing else may use them while this runs
# (design F10): the script stops when a thesis-repro.mjs process is already running.
# Output: everything goes to clean_clone_output.txt in this folder. Exit code: 0 only when every step passed.

set -u
ROOT=$(git rev-parse --show-toplevel) || exit 2
HERE="$ROOT/.docs/works/2026-11-18-p8-repro"
OUT="$HERE/clean_clone_output.txt"

KEEP=0
for a in "$@"; do
  case "$a" in
    --keep) KEEP=1 ;;
    *) echo "unknown option: $a"; exit 2 ;;
  esac
done

# Everything printed below also goes to the output file. The script runs itself once with the output piped to tee.
if [ -z "${CCC_INNER:-}" ]; then
  CCC_INNER=1 bash "$0" "$@" 2>&1 | tee "$OUT"
  exit "${PIPESTATUS[0]}"
fi

cd "$ROOT" || exit 2
FAILED=0
CLONE=""

cleanup() {
  if [ -n "$CLONE" ] && [ -d "$CLONE" ]; then
    if [ "$KEEP" = 1 ]; then
      echo "cleanup: kept $CLONE (--keep)"
    else
      rm -rf "$CLONE" && echo "cleanup: removed $CLONE"
    fi
  fi
}
trap cleanup EXIT

stop() {  # stop <message> : nothing was touched yet
  echo "STOP: $1 Nothing was touched."
  trap - EXIT
  exit 1
}

# 1. Checks, before any work
[ -f .nvmrc ] || stop ".nvmrc is missing."
WANT=$(cat .nvmrc)
HAVE=$(node -v)
[ "$HAVE" = "$WANT" ] || stop "node -v is $HAVE but .nvmrc is $WANT (run: nvm use)."
if pgrep -f thesis-repro.mjs >/dev/null 2>&1; then
  stop "a thesis-repro.mjs process is running. It uses eval_load and Redis database 2, so wait until it has finished (design F10)."
fi
docker compose exec -T db pg_isready -U breadit -d breadit >/dev/null 2>&1 || stop "db is not up (docker compose up db redis -d)."
for z in digg_votes.zip digg_friends.zip; do
  [ -f "$ROOT/datasets/raw/digg2009/$z" ] || stop "datasets/raw/digg2009/$z is missing (see .docs/datasets.md section 4)."
done
echo "node $HAVE, npm $(npm -v), db is up, both Digg zips are there"
echo "this repo: HEAD $(git rev-parse --short HEAD) on $(git rev-parse --abbrev-ref HEAD); status of this working tree:"
git status --short | sed 's/^/  /'

# 2. Fresh clone of test-app
CLONE=$(mktemp -d "${TMPDIR:-/tmp}/breadit-p8-clone.XXXXXX")
echo "---- git clone --branch test-app"
git clone -q --branch test-app "$ROOT" "$CLONE/repo" || { echo "FAIL  git clone"; exit 1; }
cd "$CLONE/repo" || exit 1
echo "clone HEAD: $(git rev-parse --short HEAD)"
ls -d node_modules dist .env eval/data eval/results 2>/dev/null && echo "WARNING: clone is not clean"

# 3. The Digg zips by hand (git-ignored), then npm ci
mkdir -p datasets/raw/digg2009
cp "$ROOT/datasets/raw/digg2009/digg_votes.zip" "$ROOT/datasets/raw/digg2009/digg_friends.zip" datasets/raw/digg2009/ || { echo "FAIL  copy of the Digg zips"; exit 1; }
echo "---- npm ci"
npm ci || { echo "FAIL  npm ci"; exit 1; }

# 4. The repro command (about 3 hours)
echo "---- npm run thesis:repro (under caffeinate -i when it exists)"
if command -v caffeinate >/dev/null 2>&1; then
  caffeinate -i npm run thesis:repro
else
  echo "caffeinate not found: make sure the machine does not sleep"
  npm run thesis:repro
fi
RC=$?
echo "exit $RC  npm run thesis:repro"
[ $RC -eq 0 ] || FAILED=1

# 5. The clone must have no change (DW6)
echo "---- git status --short in the clone"
STATUS=$(git status --short)
if [ -z "$STATUS" ]; then
  echo "PASS  git status --short is empty"
else
  FAILED=1
  echo "FAIL  git status --short shows changes:"
  echo "$STATUS" | sed 's/^/  /'
fi

cd "$ROOT" || exit 1
if [ $FAILED -eq 0 ]; then echo "RESULT: ALL PASS"; else echo "RESULT: FAILED"; fi
exit $FAILED
