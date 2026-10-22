# Bugfix spec: {{TITLE}}

Status: draft · {{DATE}}
Type: bug · Bug ID: {{BUG_ID}} · Priority: P? · Effort: ? · Folder: `.docs/works/{{FOLDER}}/`

<!--
How to fill this in (delete the comments when done):
- Reproduce first, change nothing. Record the exact commands and their output.
- Priority and effort use the scales in .docs/Bugs Report.md §2:
  P1 thesis path · P2 security or data loss · P3 users see it · P4 minor.
  XS under 30 min · S under 2 h · M half a day · L more than a day.
- A new bug gets the next free ID in its group (T thesis path, S security, B other).
- Say WHAT and WHY. The HOW goes in design.md.
-->

## 1. Problem

<!-- One paragraph: what goes wrong, where (file and function). -->

## 2. Reproduce

1.

**Expected:**
**Actual:**
**Evidence:** <!-- command output, curl response, DB rows, Chrome. Say which data (seed, humans_v1, test users). -->

## 3. Root cause

<!-- file:function and why it happens. "Not found yet" is allowed, with what you checked. -->

## 4. Impact

<!-- Who sees it. Does it change thesis numbers or block a phase? Which other bugs touch the same code? -->

## 5. Scope

**In scope:**
-

**Out of scope:**
-

## 6. Done when

| # | Check | Expected result |
|---|---|---|
| DW1 | The reproduce steps in section 2 | The expected result |
| DW2 | A test that fails before the fix (name it in the design) | Fails before, passes after |
| DW3 | `bash .claude/hooks/verify.sh` | All checks PASS |

## 7. Thesis link

- **Phase, RQ or hypothesis:**
- **Frozen values touched (super-plan §7):** none
- **Determinism class (super-plan §2):** none
- **Changes a number reported in the thesis:** no

## 8. Open questions

1.

## Review notes

<!-- The gate-reviewer agent writes here before the author reviews. -->
