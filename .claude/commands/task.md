---
description: Start a feature, a super-plan item, an experiment or any other work. Creates the task folder, investigates, writes Spec and Impact in design.md, then stops for the author's review.
argument-hint: "<what to build or do, or a super-plan item>"
---

# /task: write Spec and Impact

Workflow: this command writes Spec and Impact only. The author reviews and types `/approve`. Then you write the Design section. Do not write the Design section, plan.md or any code here.

Request: $ARGUMENTS

## Steps

1. **Choose a slug.** 2–4 words in kebab-case, starting with the super-plan phase when there is one (`p2-schema-fixes`). Create the folder from the repo root:
   `node .claude/hooks/task.cjs new <slug> --type feature --title "<short title>"`
   It copies `.claude/templates/task.md` to `.docs/works/<date>-<slug>/design.md` and makes this the active task.

2. **Investigate before you write.** Read:
   - the code the task touches (file and function names; use the Explore agent for wide searches);
   - `.docs/super-plan.md`: the phase in §4, and §2, §5, §7 when the task touches ranking or evaluation;
   - `.docs/Bugs Report.md`: open bugs in the same code;
   - `CLAUDE.md` for the architecture rules (guards, cache versions, blocking, soft delete).

3. **Fill in sections 1 (Spec) and 2 (Impact) of design.md.**
   - Say what and why, not how.
   - Evidence is concrete. Write "not checked" when you did not check.
   - Every "Done when" row is a check someone can run, with its expected result.
   - Leave section 3 (Design) as it is in the template.
   - A frozen value (super-plan §7) that might change goes under Open questions. The author changes frozen values.
   - Keep the whole file under 800 lines. Simple words (CLAUDE.md "How to write"). Delete the template comments.

4. **Stop and report** to the author: the path, a 3–5 line summary, the open questions, and: "Review Spec and Impact in design.md, then type /approve. I will then write the Design section."
