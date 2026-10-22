---
description: Plan step of the active task. Needs an approved design.md. Writes plan.md with small, test-first steps, each with a verify command and a commit, runs the gate review, then stops for the author.
argument-hint: "[notes]"
---

# /plan: write the plan

Do not write any code here.

Notes from the author: $ARGUMENTS

## Steps

1. **Check the gate** from the repo root: `node .claude/hooks/task.cjs check plan`. If it prints BLOCKED, stop and tell the author why.

2. **Copy the template**: `node .claude/hooks/task.cjs scaffold plan`.

3. **Write plan.md** from spec.md and design.md:
   - Small steps, each S or smaller, in an order that works (dependencies first).
   - A step that changes behavior starts with its failing test (TC id from the design) and says why it fails.
   - Every TC of the design is in a step. Every DW of the spec is checked in a step.
   - Each step ends with a verify command and its expected result, and one commit. Use the repo style (`fix:`, `feat:`, `test:`, `docs:`). Commits go on `test-app` and are never pushed.
   - Say what a step needs to run: Docker db and redis for integration tests, `/run-safe` for curl checks, `npm run build -w @breadit/shared` before the frontend typecheck.
   - Schema changes go through a real migration (`prisma migrate dev`), never `db push`.
   - The last step is Record: update the Bugs Report row, the super-plan change log (if the plan says a frozen value changes, which needs /freeze), CLAUDE.md (if commands change), then run /verify.
   - Delete the template comments.

4. **Gate review.** Start the `gate-reviewer` agent (stage `plan`). Fix what is clearly wrong. Put the rest under "Review notes".

5. **Stop and report** to the author: the number of steps, the commits, the time guess, what each step needs (Docker, backend), and: "Review plan.md, then type /approve. Approving the plan also approves the commits it lists. Next: /implement."
