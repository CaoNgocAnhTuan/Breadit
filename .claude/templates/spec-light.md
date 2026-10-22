# Light task: {{TITLE}}

Status: draft · {{DATE}}
Mode: light · Type: {{TYPE}} · Bug ID: {{BUG_ID}} · Effort: XS · Folder: `.docs/works/{{FOLDER}}/`

<!--
Light mode is for XS work only (under 30 minutes, one or two files, no schema change).
Spec, design and plan are in this one file, and the author approves it once.
If the work turns out bigger, stop and start a normal task.
-->

## 1. Problem

<!-- What is wrong, where (file and function), and the evidence. -->

## 2. Fix

<!-- The change in a few lines: files and what changes. -->

## 3. Test

<!-- The test that fails before the fix, or the check that shows the fix when no test fits. -->

## 4. Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | | |

## 5. Steps

- [ ] Test first: write the test and run it; it fails
- [ ] Fix:
- [ ] Verify: `bash .claude/hooks/verify.sh --quick`
- [ ] Commit: `fix: ...`
- [ ] Record: update the row in `.docs/Bugs Report.md` (if it is a known bug)

## 6. Thesis link

- **Changes a number reported in the thesis:** no

## Result

<!-- Filled in during /implement. -->

## Review notes

<!-- The gate-reviewer agent writes here before the author reviews. -->
