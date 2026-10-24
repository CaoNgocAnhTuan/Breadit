#!/usr/bin/env bash
# part.sh 3 5 : run only TC3 and TC5 (functions come from check.sh; eval because bash 3.2 has no source <(...))
eval "$(sed '/^out=\$(tc2)/,$d' "$(dirname "$0")/check.sh")"
for t in "$@"; do run "TC$t" "tc$t"; done
exit "$FAILED"
