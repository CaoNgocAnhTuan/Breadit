---
description: Design step of the active task. Needs an approved spec.md. Starts the designer agent (Opus) to write design.md with modules, classes, sequence diagrams, test cases and failure modes, runs the gate review, then stops for the author.
argument-hint: "[notes for the designer]"
---

# /design: write the design

Do not write plan.md or any code here.

Notes from the author: $ARGUMENTS

## Steps

1. **Check the gate** from the repo root: `node .claude/hooks/task.cjs check design`. If it prints BLOCKED, stop and tell the author why.

2. **Copy the template**: `node .claude/hooks/task.cjs scaffold design`.

3. **Start the `designer` agent** (it runs on Opus). Give it:
   - the task folder path;
   - the author's notes above, and any answers to the spec's open questions from this conversation (the agent cannot see this conversation);
   - for eval or ranking work, a reminder to follow `.claude/rules/determinism.md` and `.claude/rules/evaluation.md`.
   It reads spec.md and the code itself and fills in design.md.

4. **Read design.md yourself.** Every "Done when" row (DW) must have a test case (TC). The design must stay inside the spec's scope.

5. **Gate review.** Start the `gate-reviewer` agent (stage `design`). Also start `leakage-auditor` when the task touches `eval/` or ranking, and `committee` for experiment and writing tasks. Run them in parallel. Fix what is clearly wrong (or send it back to the designer). Put the rest under "Review notes".

6. **Stop and report** to the author: the approach in 3 lines, where the diagrams are, the top risks, the review notes, and: "Review design.md, then type /approve. Next: /plan."
