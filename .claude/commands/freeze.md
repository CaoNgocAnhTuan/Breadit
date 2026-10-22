---
description: The author changes a frozen value of the thesis (super-plan §7), with a new version and a dated change-log line. Only the author can run this.
argument-hint: "<item> <new value> [reason]"
disable-model-invocation: true
---

# /freeze: change a frozen value

The author wants this change: $ARGUMENTS

1. **Find the row** in the "Frozen values" table of `.docs/super-plan.md` (§7). Quote it. If the item is not there, stop and say so.
2. **Check the timing.** If the first test-split run has happened (results in `.docs/results/`, or a line in the change log), warn the author: every experiment that uses the value must run again, and the thesis must report the change.
3. **Get the reason.** If the author gave none, ask for one sentence and wait.
4. **Edit `.docs/super-plan.md`:**
   - the new value in the §7 row;
   - the version in the header line, one step up (0.1 → 0.2);
   - a change-log line at the end: `- 0.x · YYYY-MM-DD · <item>: <old> → <new>. Reason: <reason>.`
5. **Config files.** If the value also lives in an eval config (`eval/config/synthetic-vN.json`), do not edit that file. Copy it to version N+1 with the new value. That is a code change: it needs an approved plan, or the hook asks the author.
6. **Report** what changed and what must run again (experiments, hashes in the manifest).
