#!/usr/bin/env bash
# P0 check: Node and Docker images are pinned. Read-only.
# Usage: bash check_pins.sh [--no-docker]
#   --no-docker  skip the image-node check (it runs `docker run` on the pinned Node image)
# Prints one PASS or FAIL line per check. Exit code 0 only when every check that ran passed.

set -u
ROOT=$(git rev-parse --show-toplevel) || exit 2
cd "$ROOT" || exit 2

NO_DOCKER=0
for a in "$@"; do
  case "$a" in
    --no-docker) NO_DOCKER=1 ;;
    *) echo "unknown option: $a"; exit 2 ;;
  esac
done

FAILED=0
pass() { echo "PASS  $1  $2"; }
fail() { echo "FAIL  $1  $2"; FAILED=1; }

DOCKERFILES="apps/backend/Dockerfile apps/frontend/Dockerfile"
COMPOSE="docker-compose.yml"
PINNED_RE='@sha256:[0-9a-f]{64}'
NVMRC_OK=0
NVMRC=""

# 1. nvmrc: exists, exactly one line, vMAJOR.MINOR.PATCH
if [ -f .nvmrc ] && [ "$(wc -l < .nvmrc | tr -d ' ')" = "1" ] \
   && grep -Eq '^v[0-9]+\.[0-9]+\.[0-9]+$' .nvmrc; then
  NVMRC=$(cat .nvmrc)
  NVMRC_OK=1
  pass nvmrc ".nvmrc = $NVMRC"
else
  fail nvmrc ".nvmrc is missing or is not one line vX.Y.Z"
fi

# 2. engines: root package.json has engines.node and the major of .nvmrc is inside it
ENG=$(node -e 'const e=(require("./package.json").engines||{}).node;if(e)process.stdout.write(e)' 2>/dev/null)
if [ -z "$ENG" ]; then
  fail engines "root package.json has no engines.node"
elif [ "$NVMRC_OK" = 1 ]; then
  MAJOR=${NVMRC#v}; MAJOR=${MAJOR%%.*}
  # simple range test for ">=A <B"
  LO=$(echo "$ENG" | sed -nE 's/.*>=\s*([0-9]+).*/\1/p')
  HI=$(echo "$ENG" | sed -nE 's/.*<\s*([0-9]+).*/\1/p')
  if [ -n "$LO" ] && [ -n "$HI" ] && [ "$MAJOR" -ge "$LO" ] && [ "$MAJOR" -lt "$HI" ]; then
    pass engines "engines.node \"$ENG\" contains major $MAJOR"
  else
    fail engines "engines.node \"$ENG\" does not contain major $MAJOR of .nvmrc"
  fi
else
  fail engines "engines.node is \"$ENG\" but .nvmrc is not valid, cannot compare"
fi

# 3. from-pinned: every FROM line and every "# syntax=" line has @sha256:<64 hex>
BAD=""
for f in $DOCKERFILES; do
  while IFS= read -r line; do
    echo "$line" | grep -Eq "$PINNED_RE" || BAD="$BAD\n  $f: $line"
  done < <(grep -E '^(FROM |# syntax=)' "$f")
done
if [ -z "$BAD" ]; then
  pass from-pinned "all FROM and syntax lines carry @sha256"
else
  fail from-pinned "unpinned lines:$(printf '%b' "$BAD")"
fi

# 4. from-same: the six Node FROM lines carry one and the same pinned reference
REFS=$(grep -hE '^FROM ' $DOCKERFILES | awk '{print $2}' | sort -u)
COUNT=$(grep -hEc '^FROM ' $DOCKERFILES | paste -sd+ - | bc)
NREFS=$(echo "$REFS" | grep -c .)
if [ "$COUNT" = "6" ] && [ "$NREFS" = "1" ] && echo "$REFS" | grep -Eq "$PINNED_RE"; then
  pass from-same "6 FROM lines, one pinned reference: $REFS"
else
  fail from-same "FROM lines: $COUNT, distinct references: $NREFS ($(echo $REFS | tr '\n' ' '))"
fi

# 5. compose-pinned: every image: line has @sha256:<64 hex>
BAD=""
while IFS= read -r line; do
  echo "$line" | grep -Eq "$PINNED_RE" || BAD="$BAD\n  $line"
done < <(grep -E '^\s*image:' "$COMPOSE")
if [ -z "$BAD" ] && grep -Eq '^\s*image:' "$COMPOSE"; then
  pass compose-pinned "all image: lines carry @sha256"
else
  fail compose-pinned "unpinned lines:$(printf '%b' "$BAD")"
fi

# 6. image-node: node -v inside the pinned Node image equals .nvmrc
if [ "$NO_DOCKER" = 1 ]; then
  echo "SKIP  image-node  --no-docker"
else
  REF=$(echo "$REFS" | head -n 1)
  if [ "$NVMRC_OK" != 1 ]; then
    fail image-node ".nvmrc is not valid, nothing to compare"
  elif ! echo "$REF" | grep -Eq "$PINNED_RE"; then
    fail image-node "Node image is not pinned by digest: $REF"
  else
    IMGV=$(docker run --rm "$REF" node -v 2>/dev/null | tr -d '\r')
    if [ "$IMGV" = "$NVMRC" ]; then
      pass image-node "node -v in image = $IMGV"
    else
      fail image-node "node -v in image = '${IMGV:-<no output>}', .nvmrc = $NVMRC"
    fi
  fi
fi

# 7. local-node: node -v in this shell equals .nvmrc
LOCAL=$(node -v 2>/dev/null)
if [ "$NVMRC_OK" = 1 ] && [ "$LOCAL" = "$NVMRC" ]; then
  pass local-node "node -v = $LOCAL"
else
  fail local-node "node -v = '${LOCAL:-<none>}', .nvmrc = '${NVMRC:-<missing>}'"
fi

exit $FAILED
