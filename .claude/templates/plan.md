# Plan: {{TITLE}}

Status: draft · {{DATE}}
Design: [design.md](design.md) · Folder: `.docs/works/{{FOLDER}}/`

<!--
Maximum 600 lines. Delete these comments when done.
- Steps in the order they must be done. Each step is one short paragraph: what to do, in which file or module,
  and which part of design.md it comes from ("Design: Code files, likes.service.ts").
- Do not write exact commands. The implementer knows how to run tests and the build. The plan only sets the order
  and points back to the design.
- Say where commits go: one per step, or several steps in one. Commits are on test-app and never pushed.
  Approving this plan also approves the commits it lists.
- Tests come first. Every DW of the spec is covered by a test or an acceptance item.
- Schema changes go through a real migration, never `db push`.
-->

## Steps

<!-- Sonnet ticks these. -->

- [ ] 1. <what to do> (Design: <section, file>). Commit: `<type>: <message>`
- [ ] 2.

## Tests

<!-- Written before the code they test. Level: unit (apps/backend/src/**/*.spec.ts) or IT (apps/backend/test/it, needs db and redis). -->

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | | |

## Acceptance

<!-- Behaviors to check by hand after the code is done (curl against the backend from run-safe.sh, a script, the UI).
     Say what to check and the expected result, not the command. Claude ticks these. -->

- [ ] <behavior> → <expected result>

## Result

<!-- Claude fills this in at the end: what was done, test counts, commits, and anything that differed from the plan (and why). -->
