#!/usr/bin/env bash
# Checks for the task 2026-10-23-p1-literature. Run from the repo root.
# Each check prints problems only. No output = PASS. Lines that start with "CHECK" are for a
# person to read; they do not fail the check.
set -u
L=${L:-.docs/literature.md}
SP=${SP:-.docs/super-plan.md}
TASK=.docs/works/2026-10-23-p1-literature
FAILED=0

run() {
  local id=$1 out bad
  out=$("$2" 2>&1)
  bad=$(printf '%s\n' "$out" | grep -v -e '^CHECK' -e '^$' || true)
  if [ -z "$bad" ]; then echo "$id PASS"; else echo "$id FAIL"; FAILED=1; fi
  [ -n "$out" ] && printf '%s\n' "$out" | sed 's/^/    /'
  return 0
}
section() { sed -n "/^## $1\./,/^## /p"; }   # a super-plan section, up to the next "## " heading

tc1() {
  local n; n=$(grep -c '^- PDF tool:' "$L")
  [ "$n" -ge 1 ] || echo "no '- PDF tool:' line in §3"
  grep '^- PDF tool:' "$L" | sed 's/^/CHECK /'
}

tc2() {
  diff <(section 10 < "$SP" | grep -oE '^[0-9]+\.' | tr -d . | sort -n) \
       <(grep -oE '^### \[[0-9]+\]' "$L" | grep -oE '[0-9]+' | sort -n)
}

tc3() {
  awk 'function check() {
         if (!(s && f && c && o)) print ref, "missing:" (s ? "" : " Says") (f ? "" : " For-us") (c ? "" : " Cited-in") (o ? "" : " Opened")
         if (full && !a) print ref, "read in full text but has no Anchor with a § or a path" }
    /^##/ && !/^####/ { if (ref != "") check(); ref = ($0 ~ /^### \[[0-9]+\]/) ? $2 : ""; s = f = c = o = a = full = 0; next }
    ref != "" {
      if (/Says:/) s = 1; if (/For us:/) f = 1; if (/Cited in:/) c = 1
      if (/^- Opened: 20[0-9][0-9]-[0-9][0-9]-[0-9][0-9], (full text( \(§[^)]*\))?|abstract only|index record)( \[| ·|$)/) { o = 1; if (/^- Opened: [0-9-]+, full text/) full = 1 }
      if (/Anchor: .*(§[0-9]|\/|paragraph)/) a = 1 }
    END { if (ref != "") check() }' "$L"
}

tc4() {
  [ "$(grep -m1 '^## ' "$L")" = "## 1. Status table" ] || echo "the first section is not '## 1. Status table'"
  awk -F'|' '$2 ~ /^ \[(5|7|16|23)\] $/ { n++; v = $5; gsub(/^ +| +$/, "", v)
      if (v !~ /^(verified|do not cite, use \[[0-9]+\])$/) print $2, "status:", v }
    END { if (n != 4) print n + 0, "of the rows [5] [7] [16] [23] found, want 4" }' "$L"
}

tc5() {
  awk -F'|' '/^\| \[[0-9]+\] \|/ { v = $5; r = $6; c = $8
      gsub(/^ +| +$/, "", v); gsub(/^ +| +$/, "", r); gsub(/^ +| +$/, "", c); sub(/ \(§[^)]*\)$/, "", r)
      if (c == "not cited") next
      if (v != "verified" || r == "abstract only") print $2, "cited in", c, "but", v, "/", r
      else if (r == "index record" && c !~ /name only/) print $2, "index record, cited in", c, "without (name only)" }' "$L"
}

tc6() {
  local norm='{ m = $0; sub(/^[^|]*\|/, "", m); v = (m ~ /^ *verified/) ? "verified" : (m ~ /^ *search only/) ? "search only" : (m ~ /^ *do not cite/) ? "do not cite" : "other:" m; print $1, v }'
  diff <(section 10 < "$SP" | grep -E '^[0-9]+\. ' | sed -E 's/^([0-9]+)\. .* · /\1|/' | awk -F'|' "$norm" | sort -n) \
       <(awk -F'|' '/^\| \[[0-9]+\] \|/ { k = $2; gsub(/[^0-9]/, "", k); print k "|" $5 }' "$L" | awk -F'|' "$norm" | sort -n)
}

tc7() {
  awk -F'|' '
    NR == FNR { if ($0 ~ /^\| \[[0-9]+\] \|/) { k = $2; gsub(/[^0-9]/, "", k); v = $5; gsub(/^ +| +$/, "", v); ver[k] = v }; next }
    function close_entry() { if (e != "" && !link) print "no DOI or arXiv link:", e }
    /^## 7\./ { p = 1; next }
    /^## / { p = 0 }
    !p { next }
    /^### \[/ { close_entry(); e = $0; link = 0; n++
      k = $0; sub(/^### \[/, "", k); sub(/\].*/, "", k)
      if (ver[k] != "verified") print "not verified in the status table:", e
      y = 0; s = $0
      while (match(s, /\([^()]*\)/)) { g = substr(s, RSTART + 1, RLENGTH - 2); if (g ~ /(19|20)[0-9][0-9]$/) y = substr(g, length(g) - 3) + 0; s = substr(s, RSTART + RLENGTH) }
      if (y == 0) print "no (... YYYY) group in the heading:", e; else if (y < 2022) print "older than 2022:", e
      if (y >= 2024) r++
      next }
    /https:\/\/(doi\.org|arxiv\.org)\// { link = 1 }
    END { close_entry()
      print ((n >= 8 && n <= 12) ? "CHECK PASS" : "FAIL"), n + 0, "recent refs (want 8 to 12)"
      print ((n > 0 && 2 * r >= n) ? "CHECK PASS" : "FAIL"), r + 0, "of them from 2024 or later (want at least half)" }' "$L" "$L"
}

tc8() {
  awk '/^## 7\./ { p = 1; next } /^## / { p = 0 } p && /How C2 differs:/ { n++ }
    END { if (n < 3 || n > 5) print n + 0, "closest-work lines in §7, want 3 to 5"; else print "CHECK", n, "closest-work lines in §7" }' "$L"
  awk '/^### Older neighbours/ { p = 1; next } /^##/ { p = 0 } p && /How C2 differs:/ { n++ }
    END { if (n < 2) print n + 0, "older-neighbour lines, want at least 2 ([5] and [6])"; else print "CHECK", n, "older-neighbour lines" }' "$L"
  local q
  for q in Q1 Q2 Q3 Q4 Q5 Q6; do grep -q -E "^\| [0-9-]+ \|[^|]*\| $q:" "$L" || echo "search log has no row for $q"; done
  for q in 2 5 9; do grep -q -E "^\| [0-9-]+ \|[^|]*\| cited-by \[$q\]" "$L" || echo "search log has no 'cited-by [$q]' row"; done
}

tc9() {
  local col
  for col in 2 4; do
    diff <(section 4 < "$SP" | sed -n '/^| Design question/,/^$/p' | grep '^| ' | sed '1d' | cut -d'|' -f$col | sed -E 's/^ +//; s/ +$//') \
         <(grep -E "^- $([ $col = 2 ] && echo Question || echo Decides):" "$L" | sed -E 's/^- [A-Za-z]+: //; s/ +$//')
  done
}

tc10() {
  awk '
    NR == FNR { if ($0 ~ /^\| PC[0-9]+ \|/) { k = $2; gsub(/ /, "", k); pc[k] = 1 }; next }
    function flush(   i, miss, id) {
      miss = ""; for (i = 1; i <= nw; i++) if (!(want[i] in got)) miss = miss " " want[i]
      if (miss != "") print d, "missing:" miss
      if (("Options" in got) && !(opt ~ /\(a\)/ && opt ~ /\(b\)/)) print d, "Options needs (a) and (b)"
      if (("Label" in got) && lab !~ /^- Label: (direct|by analogy|consistent only|against)( \(abstract only\))? *$/) print d, "bad Label:", lab
      if ("Status" in got) {
        if (st !~ /^- Status: (decided|open|proposed change \(PC[0-9]+\)) *$/) print d, "bad Status:", st
        else if (match(st, /PC[0-9]+/)) { id = substr(st, RSTART, RLENGTH); if (!(id in pc)) print d, "Status names", id, "but §9 has no such row" } }
      if ("Choice" in got) {
        if (ch !~ /(Supported by|Consistent with|By analogy with) \[[0-9]+\]|Own design/) print d, "bad Choice:", ch
        else if (ch ~ /Supported by/ && lab !~ /^- Label: direct/) print d, "\"Supported by\" needs Label direct" }
      if (d == "D1." && gap < 4) print d, gap + 0, "Domain gap lines, want at least 4"
      if (d == "D3." && str !~ /^- Strength: (strong|weak|exploratory) *$/) print d, "needs - Strength: strong | weak | exploratory"
      split("", got); opt = lab = st = ch = str = key = ""; gap = 0 }
    BEGIN { nw = split("Question Decides Options Evidence Against Label Choice Status Result Feeds", want, " ") }
    /^##/ { if (d != "") flush(); d = ($0 ~ /^### D[1-7]\./) ? $2 : ""; next }
    d == "" { next }
    /^- [A-Z][A-Za-z\047 ]*:/ { key = $0; sub(/^- /, "", key); sub(/:.*/, "", key); got[key] = 1
      if (key == "Label") lab = $0; if (key == "Status") st = $0; if (key == "Choice") ch = $0; if (key == "Strength") str = $0 }
    key == "Options" { opt = opt " " $0 }
    key == "Domain gap" && /^  - \[[0-9]+\]/ { gap++ }
    d == "D6." && /^\| / && !/^\|[-| ]+\|$/ && !/^\| Leakage case/ { c = $0; sub(/ *\| *$/, "", c); sub(/.*\| */, "", c)
      if (c != "covered by the plan, to be tested by the P5 leakage test" && c != "gap" && c != "not applicable") print d, "bad leakage status:", c }
    END { if (d != "") flush() }' "$L" "$L"
  diff <(seq 1 7) <(grep -oE '^### D[1-7]\.' "$L" | grep -oE '[1-7]') > /dev/null || echo "want exactly the headings D1. to D7., in order"
}

tc11() {
  awk '
    function cut(v,   i) { i = index(v, " ["); if (i) v = substr(v, 1, i - 1); i = index(v, " ·"); if (i) v = substr(v, 1, i - 1); sub(/ +$/, "", v); return v }
    NR == FNR {
      if ($0 ~ /^### \[[0-9]+\]/) { k = $2; gsub(/[^0-9]/, "", k) }
      else if (k != "" && $0 ~ /^- Opened: /) { v = $0; sub(/^- Opened: [0-9-]+, /, "", v); depth[k] = cut(v); k = "" }
      next }
    function out(   s, n, dv) { s = ev
      while (match(s, /\[[0-9]+\]/)) { n = substr(s, RSTART + 1, RLENGTH - 2); dv = (n in depth) ? depth[n] : "no entry"
        if (dv !~ /^full text/ && lab !~ /abstract only/) print d, "rests on [" n "], read:", dv
        else if (dv ~ /^full text \(/) print "CHECK", d, "uses [" n "], read only", dv, "- the decision may use only those sections"
        s = substr(s, RSTART + RLENGTH) } }
    /^##/ { if (d != "") out(); d = ($0 ~ /^### D[1-7]\./) ? $2 : ""; ev = lab = ""; inev = 0; next }
    d == "" { next }
    /^- [A-Z][A-Za-z\047 ]*:/ { inev = ($0 ~ /^- Evidence:/); if ($0 ~ /^- Label:/) lab = $0 }
    inev { ev = ev " " $0 }
    END { if (d != "") out() }' "$L" "$L"
}

tc12() {
  awk '/^### D1\./ { p = 1; next } /^##/ { p = 0 } p' "$L" | grep -q -i 'author term' || echo "D1 does not cover the author term"
  local d2; d2=$(awk '/^### D2\./ { p = 1; next } /^##/ { p = 0 } p' "$L")
  printf '%s\n' "$d2" | grep -q 'same shape as, but differs in' || echo "D2 has no 'same shape as, but differs in'"
  local r; for r in count total prior support; do printf '%s\n' "$d2" | grep -q "^| $r |" || echo "D2 mapping table has no '$r' row"; done
  printf '%s\n' "$d2" | grep -i -E 'smoothing|one curve|phases' | sed 's/^/CHECK /'
}

tc13() {
  grep -n -i -E 'diffnet|neural influence' "$L" | sed 's/^/CHECK /'
  grep -n -i -E 'diffnet[[:space:]]*:' "$L"
  grep -n -i 'neural influence' "$L" | grep -v -F 'A Neural Influence Diffusion Model for Social Recommendation'
}

tc14() {
  awk 'function flush() { if (g != "") { n++; if (q != 3 || r != 1 || bad) print g, q, "questions ending in (answer in §x),", r, "Read lines" (bad ? ", and other numbered lines" : "") } g = "" }
    /^#### Reading guide/ { flush(); g = ref; q = r = bad = 0; next }
    /^##/ { flush(); if (/^### \[/) ref = $2; next }
    g != "" { if (/^[1-9]\. /) { if (/^[1-3]\. .*\(answer in §[0-9][^)]*\) *$/) q++; else bad = 1 }; if (/^- Read:/) r++ }
    END { flush(); if (n != 5) print n + 0, "reading guides, want 5" }' "$L"
  local r5; r5=$(awk -F'|' '$2 ~ /^ \[5\] $/ { r = $6; gsub(/^ +| +$/, "", r); print r }' "$L")
  case "$r5" in
    "full text"*) ;;
    *) awk '/^### \[5\]/ { p = 1; next } /^### / { p = 0 } p' "$L" | grep -q 'Could not be opened' || echo "[5] is '$r5' but its guide does not say 'Could not be opened'" ;;
  esac
}

tc15() {
  local first base
  first=$(git rev-list HEAD -- "$TASK" | tail -1)
  if [ -n "${BASE:-}" ]; then base=$BASE; elif [ -n "$first" ]; then base="$first^"; else base=$(git rev-parse HEAD); fi
  local old; old=$(mktemp); git show "$base:.docs/super-plan.md" > "$old"
  git status --short | sed 's/^/CHECK status: /'
  git diff --stat "$base" -- . | sed 's/^/CHECK diff: /'
  git diff --name-only "$base" -- . | grep -v -E "^(\.docs/literature\.md|\.docs/super-plan\.md|$TASK/.*)$" | sed 's/^/outside the allowed files: /'
  local s; for s in 1 2 3 5 7 8 9 11; do diff <(section $s < "$old") <(section $s < "$SP") > /dev/null || echo "super-plan §$s changed"; done
  for s in 4 6; do diff <(section $s < "$old") <(section $s < "$SP") | grep '^>' | cut -c3-92 | sed "s/^/CHECK §$s line now: /"; done
  awk 'NR == FNR { if (match($0, /^[0-9]+\. /)) old[substr($0, 1, RLENGTH - 2)] = $0; else oldt[$0] = 1; next }
    function url(s) { return match(s, /https?:\/\/[^ ]+/) ? substr(s, RSTART, RLENGTH) : "" }
    match($0, /^[0-9]+\. /) { n = substr($0, 1, RLENGTH - 2)
      if (!(n in old)) print "CHECK §10 new reference [" n "]"
      else if (old[n] != $0) {
        if (n !~ /^(5|7|16|23)$/) print "CHECK EXTRA, needs the author: §10 entry [" n "] changed"
        else { print "CHECK §10 mark of [" n "] changed"; if (url(old[n]) != url($0)) print "CHECK EXTRA, needs the author: URL of [" n "] changed" } }
      next }
    !($0 in oldt) { print "CHECK EXTRA, needs the author: §10 text changed: " substr($0, 1, 70) }' <(section 10 < "$old") <(section 10 < "$SP")
  rm -f "$old"
}

tc16() {
  perl -ne '
    next if $. == 1 || /^\|[-| ]+\|$/ || /^- (Opened|Question|Decides):/;
    $inentry = /^### \[\d+\]/ ? 1 : 0 if /^#{2,3} /;
    my $orig = $_;
    if (/^\| \d{4}-\d{2}-\d{2} \|/) { my @f = split /\|/, $_, -1; $f[1] = ""; $f[4] = ""; $_ = join "|", @f }
    if (/^\| \[\d+\] \|/)           { my @f = split /\|/, $_, -1; $f[6] = ""; $_ = join "|", @f }
    s{https?://\S+}{}g; s/\b[0-9a-f]{40}\b//g;
    s/\b\d{4}-\d{2}-\d{2}-p\d+-[a-z-]+//g; s/\bp\d+-[a-z-]+//g; s/\b\d{4}-\d{2}-\d{2}\b//g;
    1 while s/(\([^()]*?)\b(?:19|20)\d{2}\b(?=[^()]*\))/$1/;
    s/\[\d+\]//g;
    s/§\s?\d+(?:\.\d+)*(?:(?:–|-)\d+(?:\.\d+)*)?//g;
    s/\b(?:DW|TC|BL|RQ|PC|Ch|W|E|H|C|D|F|P|S|M|Q)\d+\b//g;
    s/\b[12][ -]hops?\b//g;
    s/^#+\s+(?:\d+\.)?//; s/^\s*\d+\.\s//; s/^\|\s*\d+\s*\|//;
    next unless /\d/;
    next if $orig =~ /\[\d+\]\s*§|super-plan §/;
    next if $inentry && $orig =~ /§/;
    print "CHECK line $.: $orig";
  ' "$L"
  grep -n -E '20261014|2026-01-01|10,000|10000|0\.05|2,000|7 days|7-day|`?m`? *= *`?5\b|200 users|1,000 users|4k posts|20k posts|0, 1, 2, 4, 8, 16|0, 2, 5, 10' "$L" | sed 's/^/frozen value copied, link to super-plan §7 instead: /'
}

tc17() {
  awk -F'|' '/^\| (10|[1-9]) \|/ { n++; k = $2 + 0; s = $4; e = $5; gsub(/^ +| +$/, "", s)
      if (s !~ /^(supported|own design|not supported)$/) { print "claim", k, "bad status:", s; next }
      if (s == "supported") {
        if (k == 1 && e !~ /status table/) print "claim 1 is supported but its Evidence does not name the status table"
        if (k == 10 && e !~ /search log/) print "claim 10 is supported but its Evidence does not name the search log"
        if (k >= 2 && k <= 9 && e !~ /\[[0-9]+\]/) print "claim", k, "is supported but has no [n] in Evidence" }
      if (k == 3) {
        if ($0 !~ /2023 release at commit/) print "claim 3 does not say \"2023 release at commit\""
        if ($0 !~ /[0-9a-f]{40}/) print "claim 3 has no 40-character commit hash"
        if ($0 !~ /`[^`]*\/[^`]*`/) print "claim 3 has no file path in backticks" } }
    END { if (n != 10) print n + 0, "claim rows, want 10" }' "$L"
}

tc18() {
  awk -F'|' '
    function norm(x,   o) { o = ""; while (match(x, /Ch[0-9]+|not cited|name only/)) { o = o substr(x, RSTART, RLENGTH) ";"; x = substr(x, RSTART + RLENGTH) }; return o }
    function cut(v,   i) { i = index(v, " ["); if (i) v = substr(v, 1, i - 1); i = index(v, " ·"); if (i) v = substr(v, 1, i - 1); sub(/ +$/, "", v); return v }
    NR == FNR { if ($0 ~ /^\| \[[0-9]+\] \|/) { k = $2; gsub(/[^0-9]/, "", k); rows++
        r = $6; o = $7; c = $8; gsub(/^ +| +$/, "", r); gsub(/^ +| +$/, "", o); gsub(/^ +| +$/, "", c)
        if (r !~ /^(full text|abstract only|index record)$/) print "[" k "] Read in the table must be one of the three values, not:", r
        tr[k] = r; to[k] = o; tc[k] = norm(c) }
      next }
    /^### \[[0-9]+\]/ { k = $0; sub(/^### \[/, "", k); sub(/\].*/, "", k); seen[k] = 1; next }
    /^##/ && !/^####/ { k = ""; next }
    k != "" && /^- Opened: / { v = $0; sub(/^- Opened: /, "", v); ed = substr(v, 1, 10); v = cut(substr(v, 13)); b = v; sub(/ \(§[^)]*\)$/, "", b)
      if (!(k in tr)) print "[" k "] has an entry but no status-table row"
      else { if (b != tr[k]) print "[" k "] Read: table", tr[k], "/ entry", v; if (ed != to[k]) print "[" k "] Opened: table", to[k], "/ entry", ed } }
    k != "" && /Cited in: / { v = $0; sub(/.*Cited in: /, "", v); i = index(v, " ·"); if (i) v = substr(v, 1, i - 1)
      if ((k in tc) && norm(v) != tc[k]) print "[" k "] Cited in: table", tc[k], "/ entry", norm(v) }
    END { for (k in tr) if (!(k in seen)) print "[" k "] has a status-table row but no entry"
      if (rows < 27) print rows + 0, "status-table rows, want at least 27" }' "$L" "$L"
}

tc19() {
  local n; n=$(grep -c '^- Spot check' "$L")
  [ "$n" -ge 2 ] || echo "$n spot-check lines in §3, want 2 (the author's 5 entries and the writer's 3)"
  grep '^- Spot check' "$L" | sed 's/^/CHECK /'
}

out=$(tc2)
if [ -n "$out" ]; then
  echo "TC2 FAIL (the other checks need the right reference set, so they did not run)"
  printf '%s\n' "$out" | sed 's/^/    /'
  exit 1
fi
echo "TC2 PASS"
for t in 1 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19; do run "TC$t" "tc$t"; done
exit "$FAILED"
