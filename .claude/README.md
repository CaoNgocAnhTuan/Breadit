# Breadit harness

The Claude Code setup for the thesis. It makes the author's workflow the normal path (spec → design → plan → code, each approved by the author) and makes the super-plan rules hard to break.

```
.claude/
  agents/     designer, gate-reviewer, leakage-auditor, committee
  commands/   approve, bugfix, design, freeze, implement, plan, run-safe, task, verify
  hooks/      the hooks, and the scripts the commands run (task.cjs, verify.sh, run-safe.sh)
  rules/      loaded only when Claude works on matching paths
  state/      local only: active task, last green test run, backend pid and log
  templates/  spec, design and plan templates
```

## Commands

| Command | Needs | What it does |
|---|---|---|
| `/task <item>` | nothing | New task folder, investigates, writes `spec.md`, stops |
| `/bugfix <ID>` | nothing | Same for a bug: reproduces it first, finds the root cause |
| `/design` | approved spec | The `designer` agent (Opus) writes `design.md`, then the gate review |
| `/plan` | approved design | Writes `plan.md` (small test-first steps, one commit each) |
| `/implement` | approved plan | Does the steps, ticks them, fills Result, closes the task |
| `/approve [spec\|design\|plan]` | a draft | **Author only.** Marks the file approved |
| `/freeze <item> <value>` | nothing | **Author only.** Changes a frozen value (super-plan §7) with a change-log line |
| `/verify [--quick]` | nothing | Builds, typecheck, lint, unit and integration tests, eval checks |
| `/run-safe [start\|stop\|status]` | Docker db and redis | Backend on :4000 with email and Cloudinary off |

Light mode (`/task ... --light` or `/bugfix ... --light`) is for XS work: spec, design and plan are in one file, with one approval.

## Hooks (`hooks/`, wired in `settings.json`)

| Hook | When | What |
|---|---|---|
| `pre-edit.cjs` | before Edit or Write | Refuses `docs/`, `Latex/`, `.env`, committed migrations, `humans_v1.sql`, the results manifest. Asks before code edits unless the plan is approved. Guards the task files (no self-approval, steps in order, approved files locked) |
| `pre-bash.cjs` | before Bash | Refuses `db push`, `migrate reset`, `down -v`, reading `.env`, force push, commits off `test-app`. Asks for push, tags, branches, `main`, discarding work, `--no-verify`, the eval test split |
| `pre-misc.cjs` | before Skill and scheduling tools | Claude cannot start `/approve` or `/freeze` |
| `on-prompt.cjs` | when the author sends a prompt | Writes the approval when the author types `/approve` |
| `post-edit.cjs` | after Edit or Write | Determinism check in `eval/` and `ranking/`. Missing template sections in task files |
| `session-start.cjs` | at start and after `/clear` | Branch, changes, Docker, active task and its next step |
| `stop.cjs` | when Claude ends a turn | During `/implement`: backend unit tests must pass (only re-run when backend files changed) |

Tests: `node .claude/hooks/test-hooks.cjs` (a throwaway git repo in the temp folder; the real repo is not touched).

Task helper: `node .claude/hooks/task.cjs status | use <folder> | reopen <step> | done` (run it with no arguments for the full list).

Turn every hook off: start Claude Code with `BREADIT_HARNESS=off claude`.

## Other parts

- `agents/`: `designer` (Opus, writes design.md), `gate-reviewer` (checks each file against the one before), `leakage-auditor` (eval and ranking), `committee` (plays the defense committee).
- `rules/`: `determinism.md` and `evaluation.md` load for `eval/` and `ranking/`; `thesis-writing.md` loads for `.docs/`.
- `templates/`: spec (feature, bug, experiment, writing, light), design (code, writing), plan.
- `state/`: only `.gitkeep` is in git. The rest is local: the active task, the last green test run, the `/run-safe` pid and log.

## Limits

Hooks see tool calls only. A shell command written to get around `pre-bash.cjs` can get around it, so the rules and the reviews still matter. The hooks fail open: if one crashes, the action goes ahead (the tests catch this before it happens).
