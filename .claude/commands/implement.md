---
description: Implement the approved plan of the active task, step by step and test first. Ticks each box in plan.md, commits as the plan lists, fills the Result section, runs /verify and the final review, then closes the task.
argument-hint: "[step number to start from]"
---

# /implement: build what the plan says

Start from: $ARGUMENTS (empty means the first unticked step)

## Before you start

1. From the repo root: `node .claude/hooks/task.cjs check implement`. If it prints BLOCKED, stop and tell the author why.
2. Read plan.md, design.md and spec.md of the active task (light mode: spec.md only). Run `git status` and `git branch --show-current`. The branch must be `test-app`.

## For each step, in order

1. **Test first.** Write the test the step names. Run it and check that it fails for the reason the plan gives. Tick the box.
2. **Change** the code as the design says. Tick.
3. **Verify** with the step's command. Quote the key line of the output (for example the Jest "Tests:" line). Tick.
4. **Commit** the step's files only (`git add <files>`, then `git commit`). Never push. Tick.

In an approved plan you may only tick boxes and write the Result section. The hook refuses other edits.

## Stop rule

If a step cannot be done as written (the design is wrong, a test cannot fail first, a new file or dependency is needed, a frozen value would change), **stop**. Run `node .claude/hooks/task.cjs reopen plan` (or `reopen design`), explain the problem and your proposed change to the author, and wait for /approve. Never change the plan quietly.

## After the last step

1. Run `bash .claude/hooks/verify.sh`. Every check must pass. Quote the summary.
2. Start the `gate-reviewer` agent (stage `implement`). For eval or ranking work, also start `leakage-auditor`. Fix the findings, or record why not.
3. Fill in the Result section of plan.md: what was done, test counts, hashes (eval), commits, and anything that went differently from the plan and why.
4. Close the task: `node .claude/hooks/task.cjs done`.
5. Report to the author: the commits, the verify summary, open points. Remind them that nothing is pushed.
