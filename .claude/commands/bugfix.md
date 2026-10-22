---
description: Start a bug fix. Takes a bug ID from .docs/Bugs Report.md (like T6, S5, B9) or a new bug report, reproduces the bug without changing code, finds the root cause, writes spec.md, then stops for the author's review.
argument-hint: "<bug ID like T6, or a description> [--light]"
---

# /bugfix: write the bug spec

The author's workflow has three approvals before code: spec, design, plan. This command does the first step only. Do not change any code here, not even a test.

Bug: $ARGUMENTS

## Steps

1. **Find the bug.** For an ID, read its row in `.docs/Bugs Report.md` (priority, evidence, suggested fix, phase in §6) and its notes in `.docs/Pre-thesis verify.md`. If the report says the bug belongs to a super-plan phase (for example T6 in P2), say so in the spec. A new bug gets the next free ID in its group (T thesis path, S security, B other).

2. **Create the folder** from the repo root, with a slug like `t6-unique-likes`:
   `node .claude/hooks/task.cjs new <slug> --type bug --id <ID> [--light] --title "<short title>"`
   Use `--light` only if the author asked for it and the effort is XS.

3. **Reproduce it.** Ways that change no code:
   - read the code path and name file:function;
   - start the backend with `/run-safe` and use curl (see `scripts/verify-bug-sweep.sh` for login and helper patterns);
   - query the database: `docker exec -i breadit-db-1 psql -U breadit -d breadit -At -c "<sql>"`;
   - run the existing tests or verify scripts.
   Record the exact commands and output. If you cannot reproduce it, say what you tried. That is a finding too.

4. **Find the root cause**: file:function and why it happens.

5. **Fill in spec.md.** Keep the three standard "Done when" rows (the reproduce steps now pass, a test that fails before the fix, /verify passes) and add the bug's own rows. Fill in priority and effort with the Bugs Report scales. Delete the template comments.

6. **Gate review.** Start the `gate-reviewer` agent with the folder path and stage `spec`. Put the findings you did not fix under "Review notes".

7. **Stop and report** to the author: the path, what you reproduced (one line of evidence), the root cause, the open questions, and: "Review spec.md, then type /approve. Next: /design." (Light mode: "Next: /implement.")
