---
description: Start a new thesis task (a feature, a super-plan item such as P2 or P6, an experiment E1–E7, or a writing task). Creates the task folder in .docs/works, investigates the code, writes spec.md, then stops for the author's review. Use this before any feature work; use /bugfix for bugs.
argument-hint: "<what to build, or a super-plan item> [--type feature|experiment|writing] [--light]"
---

# /task: write the spec

The author's workflow has three approvals before code: spec, design, plan. This command does the first step only. Do not write design.md, plan.md or any code here.

Request: $ARGUMENTS

## Steps

1. **Choose the type and a slug.** Type: `feature` (default), `experiment` (super-plan P7, E1–E7), or `writing` (a thesis chapter or section). The slug is 2–4 words in kebab-case, starting with the super-plan phase when there is one (`p2-schema-fixes`). Use `--light` only if the author asked for it and the work is XS (under 30 minutes, one or two files, no schema change).

2. **Create the folder** from the repo root:
   `node .claude/hooks/task.cjs new <slug> --type <type> [--light] --title "<short title>"`
   It copies the template into `spec.md` and makes this the active task.

3. **Investigate before you write.** Read:
   - the code the task touches (file and function names; use the Explore agent for wide searches);
   - `.docs/super-plan.md`: the phase in §4, the determinism contract §2, the protocol §5, the frozen values §7;
   - `.docs/Bugs Report.md`: open bugs in the same code, and the phase table in §6;
   - `CLAUDE.md` for the architecture rules (guards, cache versions, blocking, soft delete).

4. **Fill in spec.md.**
   - Say what and why, not how. No class designs or code.
   - Evidence is concrete: file:function, command output, numbers with their source. Write "not checked" when you did not check.
   - Every "Done when" row is a check someone can run, and its expected result.
   - Fill in the thesis link. If a frozen value (§7) might change, put it under Open questions; only the author changes frozen values (/freeze).
   - Follow "How to write" in CLAUDE.md. Delete the template comments.

5. **Gate review.** Start the `gate-reviewer` agent with the folder path and stage `spec`. For experiment and writing tasks, also start the `committee` agent. Fix what is clearly wrong. Put the findings you did not fix under "Review notes".

6. **Stop and report** to the author: the path, a 3–5 line summary, the open questions, and: "Review spec.md, then type /approve. Next: /design." (Light mode: "Next: /implement.")
