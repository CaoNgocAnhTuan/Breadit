#!/usr/bin/env bash
# Starts the backend on :4000 with no real email and no Cloudinary (the real .env holds live keys).
# It never reads .env. The backend runs from apps/backend, where there is no .env file, so only
# the variables set below (or already exported in the shell) are used.
#
# Usage: bash .claude/hooks/run-safe.sh [start|stop|status] [--no-cache] [--no-build]

set -u
ROOT=$(git rev-parse --show-toplevel) || exit 2
STATE="$ROOT/.claude/state"
mkdir -p "$STATE"
PIDFILE="$STATE/backend.pid"
LOG="$STATE/backend.log"

ACTION=start
NO_CACHE=0
BUILD=1
for a in "$@"; do
  case "$a" in
    start | stop | status) ACTION=$a ;;
    --no-cache) NO_CACHE=1 ;;
    --no-build) BUILD=0 ;;
    *) echo "unknown option: $a"; exit 2 ;;
  esac
done

running() { [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; }

case "$ACTION" in
  status)
    if running; then echo "backend running (pid $(cat "$PIDFILE")), log: $LOG"; else echo "backend not running"; fi
    exit 0
    ;;
  stop)
    if running; then kill "$(cat "$PIDFILE")" && rm -f "$PIDFILE" && echo "backend stopped"; else echo "backend not running"; fi
    exit 0
    ;;
esac

if running; then
  echo "backend already running (pid $(cat "$PIDFILE")), log: $LOG"
  exit 0
fi
if lsof -nP -iTCP:4000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port 4000 is used by another process:"
  lsof -nP -iTCP:4000 -sTCP:LISTEN
  exit 1
fi
NAMES=$(docker ps --format '{{.Names}}' 2>/dev/null || true)
if ! echo "$NAMES" | grep -qE '(^|[-_])db([-_][0-9]+)?$' || ! echo "$NAMES" | grep -qE '(^|[-_])redis([-_][0-9]+)?$'; then
  echo "db or redis is not running. Start them: docker compose up db redis -d"
  exit 1
fi

if [ "$BUILD" = 1 ]; then
  echo "building the backend..."
  if ! (cd "$ROOT" && npm run build -w @breadit/backend >"$STATE/backend-build.log" 2>&1); then
    echo "build failed. Last lines of $STATE/backend-build.log:"
    tail -n 20 "$STATE/backend-build.log"
    exit 1
  fi
fi

UPLOADS="${TMPDIR:-/tmp}/breadit-uploads"
mkdir -p "$UPLOADS"
export DATABASE_URL="${DATABASE_URL:-postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6378}"
export JWT_SECRET="${JWT_SECRET:-run-safe-local-secret-0123456789abcdef}"
export FRONTEND_URL="${FRONTEND_URL:-http://localhost:3000}"
export COOKIE_DOMAIN="${COOKIE_DOMAIN:-localhost}"
# No real email and no Cloudinary, whatever the shell says.
export SMTP_HOST=127.0.0.1 SMTP_PORT=1 SMTP_USERNAME= SMTP_PASSWORD= SMTP_FROM=run-safe@local.invalid
export CLOUDINARY_CLOUD_NAME= CLOUDINARY_API_KEY= CLOUDINARY_API_SECRET=
export UPLOAD_DIR="$UPLOADS"
if [ "$NO_CACHE" = 1 ]; then export REDIS_HTTP_CACHE_ENABLED=false; fi

cd "$ROOT/apps/backend" || exit 2
nohup node dist/main.js >"$LOG" 2>&1 &
echo $! >"$PIDFILE"

if curl -sf -o /dev/null --retry 30 --retry-delay 1 --retry-connrefused http://localhost:4000/api/health; then
  echo "backend up on http://localhost:4000 (pid $(cat "$PIDFILE"))"
  echo "  email off · Cloudinary off · uploads in $UPLOADS · feed cache $([ "$NO_CACHE" = 1 ] && echo off || echo on)"
  echo "  log: $LOG"
  echo "  stop: bash .claude/hooks/run-safe.sh stop"
else
  echo "the backend did not answer on /api/health. Last log lines:"
  tail -n 30 "$LOG"
  exit 1
fi
