# Breadit harness

The Claude Code setup for the thesis. Three commands, two files per task, three approvals by the author.

```
.claude/
  commands/   task, bugfix, approve
  hooks/      the hooks, task.cjs (task helper), verify.sh, run-safe.sh, test-hooks.cjs
  templates/  task.md and bug.md (the design.md of a task), plan.md
  state/      local only: the active task and the run-safe pid and log
```

## Workflow

Each task is one folder `.docs/works/YYYY-MM-DD-<slug>/` with two files.

| Step | Who | What |
|---|---|---|
| `/task <item>` or `/bugfix <ID>` | Opus | Creates the folder, investigates, writes **Spec** and **Impact** in `design.md`, stops |
| `/approve` (1) | author, then Opus | Opus writes the **Design** section in the same `design.md`, stops |
| `/approve` (2) | author, then Opus | Opus writes `plan.md`, stops |
| `/approve` (3) | author, then Opus and Sonnet | Sonnet implements the plan (tests first, commits). Opus runs `verify.sh` and the Acceptance checks, fills Result, closes the task |

- `design.md` has at most 800 lines. It holds Spec, Impact and Design (approach, sequence diagrams, failure modes and how to resolve them, code files and their purpose).
- `plan.md` has at most 600 lines. It holds ordered Steps that point back to the design, Tests, Acceptance checks and Result. It does not list exact commands.
- Opus is the main model (`"model": "opus"` in `settings.json`). Sonnet is started by Opus only for the implement step.
- Light checks, reviewers and a separate design agent are gone. The author's review is the gate.

Task state lives in status lines: `Spec status:` and `Design status:` in `design.md`, `Status:` in `plan.md` (`draft`, `approved`, `done`). Only the author's `/approve` writes "approved". Folders in `.docs/works/` from before this workflow (no `Spec status:` line) are old records and are ignored.

## Hooks (`hooks/`, wired in `settings.json`)

| Hook | When | What |
|---|---|---|
| `pre-edit.cjs` | before Edit or Write | Refuses `docs/`, `Latex/`, `.env`, committed migrations, `humans_v1.sql`, the results manifest. Refuses "approved" status lines written by Claude. Asks before code edits unless the active task's plan is approved |
| `pre-bash.cjs` | before Bash | Refuses `db push`, `migrate reset`, `down -v`, reading `.env`, force push, commits off `test-app`. Asks for push, tags, branches, `main`, discarding work, `--no-verify`, the eval test split |
| `on-prompt.cjs` | when the author sends a prompt | Writes the approval when the author types `/approve` |
| `post-edit.cjs` | after Edit or Write | Determinism check in `eval/` and ranking code (super-plan §2). Line limits of `design.md` and `plan.md` |
| `session-start.cjs` | at start and after `/clear` | Branch, changes, Docker, active task and its next step |

`/approve` is for the author only because its command file has `disable-model-invocation: true`.

## Scripts

- `node .claude/hooks/test-hooks.cjs`: tests for the hooks (a throwaway git repo in the temp folder; the real repo is not touched).
- `node .claude/hooks/task.cjs status | use <folder> | done`: task helper (`new` is run by `/task` and `/bugfix`).
- `bash .claude/hooks/verify.sh [--quick]`: shared build, frontend typecheck and lint, backend build, unit tests, integration tests (when db and redis run).
- `bash .claude/hooks/run-safe.sh start|stop|status`: backend on :4000 with email and Cloudinary off, for curl checks.

Turn every hook off: start Claude Code with `BREADIT_HARNESS=off claude`.

## Limits

Hooks see tool calls only. A shell command written to get around `pre-bash.cjs` can get around it, so the author's review still matters. The hooks fail open: if one crashes, the action goes ahead (the tests catch this before it happens).
