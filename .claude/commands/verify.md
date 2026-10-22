---
description: Run the project checks (shared build, frontend typecheck and lint, backend build, backend unit tests, integration tests when db and redis run, eval checks once eval/ exists) and report one line per check.
argument-hint: "[--quick] [--it|--no-it]"
---

# /verify

Run from the repo root:

```bash
bash .claude/hooks/verify.sh $ARGUMENTS
```

- `--quick`: shared build, typecheck and backend unit tests only.
- `--it`: run the integration tests even if Docker looks down. `--no-it`: skip them.

Report the summary table as the script prints it, with the Jest "Tests:" lines. For a failed check, show the last lines of its log and say what you think the cause is. Do not call a check passed unless the script printed PASS for it.
