#!/usr/bin/env bash
# P0 check: a clean clone of test-app passes npm ci, prisma migrate deploy, the seed,
# the shared build and the frontend typecheck, in its own schema, without touching the
# dev data in schema `public`.
#
# Usage: bash check_clean_clone.sh [--engine-test]
#   --engine-test  also run `npm ci` in a second clean clone under Node v24.14.1 and
#                  report whether npm stopped with EBADENGINE (design F5)
# Needs: docker compose db up, nvm at ~/.nvm (only for --engine-test), network.
# Exit code: 0 only when every step passed and the public counts are equal.

set -u
ROOT=$(git rev-parse --show-toplevel) || exit 2
cd "$ROOT" || exit 2

ENGINE_TEST=0
for a in "$@"; do
  case "$a" in
    --engine-test) ENGINE_TEST=1 ;;
    *) echo "unknown option: $a"; exit 2 ;;
  esac
done

# The only schema this script may write to.
SCHEMA=p0_clean
DB_USER=breadit
DB_PASS=breaditpassword
DB_NAME=breadit
DB_PORT=5433
EXPECTED_MIGRATIONS=19

guard_schema() {
  case "$1" in
    public|it_test|"")
      echo "REFUSED: schema '$1' is not allowed (only a temporary schema may be used)"
      exit 2
      ;;
  esac
}
guard_schema "$SCHEMA"

psql_q() { docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"; }
counts() {
  psql_q "SELECT (SELECT count(*) FROM public.\"User\") || ' ' || (SELECT count(*) FROM public.\"Post\") || ' ' || (SELECT count(*) FROM public.\"Like\") || ' ' || (SELECT count(*) FROM public.\"Follow\")"
}

FAILED=0
CLONE=""
CLONE2=""
SCHEMA_CREATED=0

cleanup() {
  if [ "$SCHEMA_CREATED" = 1 ]; then
    guard_schema "$SCHEMA"
    psql_q "DROP SCHEMA IF EXISTS \"$SCHEMA\" CASCADE" >/dev/null 2>&1
    echo "cleanup: dropped schema $SCHEMA"
  fi
  [ -n "$CLONE" ] && [ -d "$CLONE" ] && rm -rf "$CLONE" && echo "cleanup: removed $CLONE"
  [ -n "$CLONE2" ] && [ -d "$CLONE2" ] && rm -rf "$CLONE2" && echo "cleanup: removed $CLONE2"
}
trap cleanup EXIT

run() {  # run <label> <cmd...> ; prints the exit code
  local label=$1; shift
  echo "---- $label"
  "$@"
  local rc=$?
  echo "exit $rc  $label"
  [ $rc -ne 0 ] && FAILED=1
  return $rc
}

# 1. Node and db checks
if [ ! -f .nvmrc ]; then
  echo "STOP: .nvmrc is missing. Nothing was touched."
  trap - EXIT
  exit 1
fi
WANT=$(cat .nvmrc)
HAVE=$(node -v)
if [ "$HAVE" != "$WANT" ]; then
  echo "STOP: node -v is $HAVE but .nvmrc is $WANT (run: nvm use). Nothing was touched."
  trap - EXIT
  exit 1
fi
if ! docker compose exec -T db pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
  echo "STOP: db is not up (docker compose up db redis -d). Nothing was touched."
  trap - EXIT
  exit 1
fi
echo "node $HAVE, npm $(npm -v), db is up"

# 2. Counts before (read-only)
BEFORE=$(counts)
echo "public counts before (User Post Like Follow): $BEFORE"

# 3. Fresh clone
CLONE=$(mktemp -d "${TMPDIR:-/tmp}/breadit-p0-clone.XXXXXX")
run "git clone --branch test-app" git clone -q --branch test-app "$ROOT" "$CLONE/repo" || exit 1
cd "$CLONE/repo" || exit 1
echo "clone HEAD: $(git rev-parse --short HEAD)"
ls -d node_modules dist .env 2>/dev/null && echo "WARNING: clone is not clean"

# 4. Steps in the clone, in schema p0_clean
export DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:$DB_PORT/$DB_NAME?schema=$SCHEMA"
SCHEMA_CREATED=1   # migrate deploy creates it; cleanup drops it
PRISMA_SCHEMA=apps/backend/prisma/schema.prisma
run "npm ci" npm ci
run "prisma migrate deploy" npx prisma migrate deploy --schema=$PRISMA_SCHEMA
run "prisma db seed" npx prisma db seed --schema=$PRISMA_SCHEMA
run "build shared" npm run build -w @breadit/shared
run "typecheck" npm run typecheck

# 5. Migration count
MIG=$(psql_q "SELECT count(*) FROM \"$SCHEMA\".\"_prisma_migrations\" WHERE finished_at IS NOT NULL")
echo "finished migrations in $SCHEMA: $MIG (expected $EXPECTED_MIGRATIONS)"
if [ "$MIG" != "$EXPECTED_MIGRATIONS" ]; then FAILED=1; echo "FAIL  migration count"; else echo "PASS  migration count"; fi
echo "seed rows in $SCHEMA (User Post Like Follow): $(psql_q "SELECT (SELECT count(*) FROM \"$SCHEMA\".\"User\") || ' ' || (SELECT count(*) FROM \"$SCHEMA\".\"Post\") || ' ' || (SELECT count(*) FROM \"$SCHEMA\".\"Like\") || ' ' || (SELECT count(*) FROM \"$SCHEMA\".\"Follow\")")"

# 6. Drop the temporary schema
cd "$ROOT" || exit 1
guard_schema "$SCHEMA"
psql_q "DROP SCHEMA IF EXISTS \"$SCHEMA\" CASCADE" >/dev/null
SCHEMA_CREATED=0
GONE=$(psql_q "SELECT count(*) FROM information_schema.schemata WHERE schema_name='$SCHEMA'")
if [ "$GONE" = "0" ]; then echo "PASS  schema $SCHEMA dropped"; else FAILED=1; echo "FAIL  schema $SCHEMA still exists"; fi

# 7. Counts after
AFTER=$(counts)
echo "public counts after  (User Post Like Follow): $AFTER"
if [ "$BEFORE" = "$AFTER" ]; then echo "PASS  public counts equal"; else FAILED=1; echo "FAIL  public counts differ"; fi

# 8. Remove the clone
rm -rf "$CLONE" && echo "removed clone folder" && CLONE=""

# 9. Engine test under Node v24.14.1 (does not touch the database)
if [ "$ENGINE_TEST" = 1 ]; then
  echo "---- engine test: npm ci under Node v24.14.1"
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  CLONE2=$(mktemp -d "${TMPDIR:-/tmp}/breadit-p0-engine.XXXXXX")
  git clone -q --branch test-app "$ROOT" "$CLONE2/repo" || exit 1
  ( cd "$CLONE2/repo" && nvm exec 24.14.1 bash -c 'node -v; npm ci --ignore-scripts' ) >"$CLONE2/out.txt" 2>&1
  RC=$?
  tail -n 15 "$CLONE2/out.txt"
  if grep -q EBADENGINE "$CLONE2/out.txt" && [ $RC -ne 0 ]; then
    echo "ENGINE-TEST: npm ci under Node 24 STOPPED with EBADENGINE (exit $RC): engines are enforced"
  elif [ $RC -ne 0 ]; then
    echo "ENGINE-TEST: npm ci under Node 24 failed for another reason (exit $RC)"
    FAILED=1
  else
    echo "ENGINE-TEST: npm ci under Node 24 did NOT stop (exit 0): engines are warn only"
  fi
fi

if [ $FAILED -eq 0 ]; then echo "RESULT: ALL PASS"; else echo "RESULT: FAILED"; fi
exit $FAILED
