---
description: The author approves the next part of the active task (Spec and Impact, then Design, then plan.md). Only the author can run this. Claude then does the next step.
disable-model-invocation: true
---

# /approve

The author typed /approve. The UserPromptSubmit hook (`.claude/hooks/on-prompt.cjs`) has already written the approval, or it said why it could not. Its message is in your context: "APPROVED: spec", "APPROVED: design", "APPROVED: plan", or "/approve did nothing".

If it did nothing, say why in one line and stop. Do not edit any status line yourself.

Otherwise do the branch that matches. Use the active task folder (`node .claude/hooks/task.cjs status`).

## APPROVED: spec → write the Design section

1. Read design.md (Spec and Impact) and the code it names.
2. Write section 3 "Design" of design.md: approach and rejected options, the workflow with Mermaid sequence diagrams, the failure modes with how each is resolved, every code file with its purpose, and the data, schema and cache changes. Reuse what exists (name the files and functions). Design what the Spec asks and nothing more. A problem in the Spec goes in Open questions.
3. Set the top line to `Design status: draft · <today>`. Delete the template comments. Keep the whole file under 800 lines.
4. Stop. Report the approach in 3 lines, the top failure modes, and: "Review the Design section, then type /approve. I will then write plan.md."

## APPROVED: design → write plan.md

1. Copy `.claude/templates/plan.md` to the task folder (replace `{{TITLE}}`, `{{DATE}}`, `{{FOLDER}}`).
2. Write the plan from design.md: sequential steps that follow the design's code files, tests first, with commit points. Every DW of the Spec is covered by a test or an acceptance item. Do not write exact commands. Keep plan.md under 600 lines.
3. Stop. Report the number of steps, the commits, what the tests need (Docker db and redis for IT, the backend for curl checks), and: "Review plan.md, then type /approve. Approving the plan also approves the commits it lists. I will then have Sonnet implement it."

## APPROVED: plan → implement and verify

1. If the plan has integration tests or curl checks, make sure Docker db and redis run (`docker compose up db redis -d`).
2. Start one agent with `subagent_type: "general-purpose"` and `model: "sonnet"`. Tell it the task folder and these rules (it cannot see this conversation):
   - read design.md and plan.md, then do the Steps in order, tests first (write each test and see it fail for the right reason, then write the code);
   - run the unit tests and the integration tests the plan names; tick each step's box in plan.md when it is done;
   - commit on `test-app` as the plan says; never push; never use `prisma db push`;
   - do not change design.md, plan.md (except ticking boxes) or any status line;
   - if a step cannot be done as written, stop and report what and why. Do not work around it.
3. When it returns, read its report and `git log` and `git diff` against the plan and the design. If it stopped, decide: a small fix you do yourself, or a change to the design or plan that the author must see (explain it and wait). Do not change an approved plan quietly.
4. Run `bash .claude/hooks/verify.sh`. Every check must pass. Fix failures (or send the agent back with a narrow task).
5. Do the Acceptance items of plan.md yourself (start the backend with `bash .claude/hooks/run-safe.sh start`, use curl or scripts, stop it after). Tick each item.
6. Fill in the Result section of plan.md: what was done, test counts, commits, and anything that differed from the plan. Then run `node .claude/hooks/task.cjs done`.
7. Report to the author: delivered (feature) or resolved (bug), the commits, the verify summary, open points. Nothing is pushed.
