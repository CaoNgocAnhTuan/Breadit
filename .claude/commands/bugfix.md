---
description: Start a bug fix. Takes a bug ID from .docs/Bugs Report.md (like T6, S5, B9) or a new bug report, reproduces the bug without changing code, finds the root cause, writes Spec and Impact in design.md, then stops for the author's review.
argument-hint: "<bug ID like T6, or a description>"
---

# /bugfix: write the bug Spec and Impact

Workflow: this command writes Spec and Impact only. The author reviews and types `/approve`. Then you write the Design section. Do not change any code here, not even a test. Do not write the Design section or plan.md.

Bug: $ARGUMENTS

## Steps

1. **Find the bug.** For an ID, read its row in `.docs/Bugs Report.md` (priority, evidence, suggested fix, phase in §6) and its notes in `.docs/Pre-thesis verify.md`. If the report ties the bug to a super-plan phase, say so in Impact. A new bug gets the next free ID in its group (T thesis path, S security, B other).

2. **Create the folder** from the repo root, with a slug like `t6-unique-likes`:
   `node .claude/hooks/task.cjs new <slug> --type bug --id <ID> --title "<short title>"`

3. **Reproduce it.** Ways that change no code:
   - read the code path and name file:function;
   - start the backend with `bash .claude/hooks/run-safe.sh start` and use curl (see `scripts/verify-bug-sweep.sh` for login and helper patterns);
   - query the database: `docker exec -i breadit-db-1 psql -U breadit -d breadit -At -c "<sql>"`;
   - run the existing tests or verify scripts.
   Record the exact commands and output. If you cannot reproduce it, say what you tried. That is a finding too. Stop the backend when you are done (`bash .claude/hooks/run-safe.sh stop`).

4. **Find the root cause**: file:function and why it happens.

5. **Fill in sections 1 (Spec) and 2 (Impact) of design.md.** Keep the three standard "Done when" rows and add the bug's own rows. Fill in priority and effort with the Bugs Report scales. Leave section 3 (Design) as it is in the template. Keep the whole file under 800 lines. Simple words (CLAUDE.md "How to write"). Delete the template comments.

6. **Stop and report** to the author: the path, what you reproduced (one line of evidence), the root cause, the open questions, and: "Review Spec and Impact in design.md, then type /approve. I will then write the Design section."
