# Plan: {{TITLE}}

Status: draft · {{DATE}}
Spec: [spec.md](spec.md) · Design: [design.md](design.md) · Folder: `.docs/works/{{FOLDER}}/`

<!--
Rules for the plan (delete the comments when done):
- Small steps (each S or smaller). A step that changes behavior starts with a failing test (TC id).
- Every test case of the design is in a step. Every "Done when" row is checked in a step.
- Each step ends with a command that proves it, and one commit (on test-app, never pushed).
  Approving this plan also approves the commits it lists.
- After approval, only ticking boxes and writing Result are allowed. Any other change reopens the plan.
-->

## Steps

### Step 1: <name> (effort ?)

- [ ] Test first: <file and test name> (TC1). Run `<command>`; it fails because <reason>
- [ ] Change: <files>
- [ ] Verify: `<command>` gives <expected>
- [ ] Commit: `<type>: <message>`

### Step 2: Record (effort XS)

- [ ] Update the docs this task changes (Bugs Report row, super-plan change log, CLAUDE.md commands)
- [ ] Run `bash .claude/hooks/verify.sh`; every check passes
- [ ] Commit: `docs: <message>`

## Result

<!-- Filled in during /implement: what was done, test counts, hashes, and anything that went
     differently from the plan (and why). -->

## Review notes

<!-- The gate-reviewer agent writes here before the author reviews. -->
