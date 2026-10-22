# Spec: Claude Code harness for the thesis

Status: done · 2026-10-22
Type: feature (tooling) · Folder: `.docs/works/2026-10-22-claude-harness/`

> **Built directly (2026-10-22).** The author asked to build the harness without the design and plan steps. This spec stays as the record of what the harness does. Defaults taken for the open questions in section 8: (1) light mode exists, for XS only; (2) folders are named `YYYY-MM-DD-<slug>`; (3) approving a plan also approves the commits it lists, push still asks; (4) no clean-up was done (the old sweep files and the `thesis` branch are untouched). The file map is in `.claude/README.md`.

---

## 1. Problem

Claude Code works on Breadit with only `CLAUDE.md` and personal memory. Your workflow (spec, then design, then plan, then code, each approved by you) and the rules in the super plan exist only as text. The agent has to remember them. After a `/clear` or in a new session it starts cold, and nothing stops it from skipping a step.

This has already caused problems:
- **Numbers nobody can reproduce** in the pre-thesis report. The abstract does not match chapter 5, the k6 file has 71% failed requests, and the LightFM sentence describes code that does not exist (super-plan §3, Bugs Report §7).
- **A rule broken because it was not remembered.** On 2026-10-21 the agent made a `thesis` branch, although all work belongs on `test-app`. The old branch is still there (at `daadec9`).
- **Live secrets on disk.** `.env` holds real SMTP and Cloudinary keys. The backend was started safely by hand twice (Pre-thesis verify §2, and the header of `scripts/verify-bug-sweep.sh`).

The next phases make this more important. `eval/` and `ranking/core/` do not exist yet. The super plan bans `Date.now()` and `Math.random()` there (§2), but today's Explore code uses `Date.now()` (T4), so the habit is already in the codebase.

---

## 2. Goal

A `.claude/` folder in git that makes your workflow the normal path and makes the thesis rules hard to break. It must be ready before any P2 or P3 code is written (week 2 of the plan).

A written rule only asks. A hook always runs. So each rule that matters gets a hook where a hook is possible, and a written rule where it is not.

---

## 3. What it must do

### 3.1 Workflow commands

| Command | Needs | What it does, then it stops |
|---|---|---|
| `/task <text or super-plan item>` | nothing | Makes the task folder, reads the code, writes `spec.md`. |
| `/bugfix <bug ID or text>` | nothing | Same, but the spec starts with how to reproduce the bug and the evidence. Known IDs come from `Bugs Report.md`, with its P1–P4 and XS–L scales. |
| `/design` | approved spec | Starts the `designer` agent (Opus), which writes `design.md`. |
| `/plan` | approved design | Writes `plan.md`. |
| `/implement` | approved plan | Does the plan steps in order (test first), ticks each box, fills the Result section. |
| `/approve` | a draft file | Marks the current file approved, with the date. **Only you can run it.** |

Rules for all commands:
- A command refuses to start if the step before it is not approved, and says which file is missing.
- Before you review a spec, design or plan, the `gate-reviewer` agent checks it. Its notes go into a "Review notes" section at the end of the file.
- In `/implement`, if a step turns out to be wrong, Claude stops, updates the plan (its status goes back to draft) and waits for you. No silent changes.
- The harness keeps one active task. The commands set it, and code edits are checked against it.

### 3.2 Task files

Every file starts with a status line: `Status: draft` or `Status: approved · <date>`.

| File | Required sections |
|---|---|
| `spec.md` | Problem and evidence · Impact · Scope and out of scope · Done when (each item is a command and its expected result) · Thesis link · Open questions |
| `design.md` | Approach and rejected options · Modules, classes and files · Sequence diagrams (Mermaid) · Data and schema changes · Test cases, each tied to a "Done when" item · Failure modes · Risks |
| `plan.md` | Steps with checkboxes (files, test first, change, verify command, commit message) · A final Record step · Result (filled in during implement) |

The **thesis link** says which phase, RQ or hypothesis the task serves, which frozen values (super-plan §7) it touches, its determinism class (D or R, §2), and whether it changes a number reported in the thesis.

There is one template per task type, because each type needs a different spec:
- **Feature** and **bug:** as in the table above.
- **Experiment:** the spec names the hypothesis, the metric and the config version. The plan has the run command and the hash check.
- **Writing:** the design is an outline plus a map from each claim to its CSV, macro or reference.

### 3.3 Hooks

| ID | When | What it does |
|---|---|---|
| H1 Approval gate | before Edit or Write | Edits to code and config ask you first, unless the active task's plan is approved. Code and config means `apps/`, `packages/`, `eval/`, `scripts/`, `.claude/`, `.docs/latex/`, `.docs/results/` and the root build files. Claude can never write an "approved" status line itself. |
| H2 File guard | before Edit or Write | Refuses edits to `docs/`, `Latex/`, `.env` files (the example files are fine), committed migrations, `datasets/humans_v1.sql` and `.docs/results/manifest.json`. |
| H3 Bash guard | before Bash | Refuses `prisma db push`, `prisma migrate reset`, `docker compose down -v`, reading `.env` files, `git commit` on any branch except `test-app`, and shell writes into the H2 paths. Asks you first for `git push`, `git tag`, anything that changes `main`, and eval runs on the test split. |
| H4 Determinism check | after Edit or Write in `eval/` or `apps/backend/src/ranking/` | Reports `Date.now`, `new Date()` with no argument, `Math.random`, `.sort()` with no compare function, `localeCompare` and `toLocaleString`. Claude sees the report and fixes the code. It warns; it does not block. |
| H5 Session start | at session start and after `/clear` | Shows the branch, uncommitted files, whether db and redis are running, and the active task with its step and the next unticked plan step. |
| H6 Stop check | when Claude ends a turn during `/implement` | If backend code changed, runs the backend unit tests. If they fail, Claude must keep working. It must never loop forever. |

Every block or warning gives its reason in one line. The hooks use only tools on this Mac (bash, jq, rg, node, shasum). H1 to H5 each finish in about a second.

`settings.json` also denies the Read tool on `.env` files. It allows common read-only commands (git status, diff and log, rg, typecheck, unit tests), so you see fewer prompts. Push always asks.

### 3.4 Rules

Three files in `.claude/rules/`. Each one loads only when Claude works on its paths:
- **`determinism.md`** for `eval/` and `apps/backend/src/ranking/`: super-plan §2 as a do and don't list.
- **`evaluation.md`** for `eval/`: the main points of §5 (as-of features, one shared `buildPool`, tune on the validation item only, run the test split once).
- **`thesis-writing.md`** for `.docs/`: numbers come from macros and are never typed. Cite only references marked "verified". Do not touch `docs/` or `Latex/`.

The rules link to super-plan §7 for frozen values and never copy them, so the two cannot disagree.

### 3.5 Agents

| Agent | Model | Job |
|---|---|---|
| `designer` | Opus | Writes `design.md` from the approved spec. Reads the code, writes only that file. |
| `gate-reviewer` | session model | Read-only. Checks each new file against the one before it: every "Done when" item has a test in the design, every test has a plan step, and the code passes every check in the plan. |
| `leakage-auditor` | session model | Read-only. For eval and ranking tasks: future data in features, unseeded randomness, a live candidate pool that differs from the harness pool. |
| `committee` | session model | Read-only. For experiment and writing tasks: plays the defense committee and asks the hardest questions about the spec and design. |

### 3.6 Support commands

- **`/verify`:** runs typecheck, lint, the backend build, the unit tests, and the integration tests when Docker is up. Later it adds the eval double-run hash check. `/implement` uses it.
- **`/run-safe`:** starts the backend with SMTP and Cloudinary off and uploads in a temp folder.
- **`/freeze <item> <value>`:** makes a new config version and adds a dated line to the super-plan change log (§7).

### 3.7 CLAUDE.md

Add one short "Workflow" section that names the commands and points to `.claude/`. Nothing else in `CLAUDE.md` changes.

---

## 4. Out of scope

- `numbers-auditor`, `citation-checker` and `/supervisor-report`. They come with P9 (writing).
- Running the backend tests in the Husky pre-commit hook. That is a change to the repo setup and can be its own task.
- The P5 grep test in Jest. H4 gives fast feedback; the P5 test stays the real gate.
- Moving the old `21-10-bugs-sweep-*` files and deleting the `thesis` branch (see question 4).

---

## 5. Done when

| # | Check | Expected result |
|---|---|---|
| 1 | `git ls-files .claude` on `test-app` | Settings, hooks, rules, commands and agents are tracked. |
| 2 | `bash .claude/hooks/test/run.sh` | Every case passes. The script feeds sample tool calls to H1–H4 and checks each answer: edit `Latex/x.tex` is refused · edit backend code with no approved plan asks · the same edit with an approved plan is allowed · writing "Status: approved" is refused · `git push` asks · `prisma db push` is refused · `cat .env` is refused · a commit on another branch is refused · `Date.now()` in `eval/` is reported. |
| 3 | Dry run with a test task | `/task` writes a spec with every required section and stops. `/design` refuses before `/approve`, and the designer (Opus) writes the design after it. `/plan` and `/implement` also refuse before their step is approved. The test folder is removed afterwards. |
| 4 | Claude tries to run `/approve` | It cannot. |
| 5 | Start a new session | H5 shows the branch, changes, Docker state and the active task. |
| 6 | `npm run typecheck` and `npm run test -w @breadit/backend` | Both still pass (99 unit tests). The harness changes no app code. |

---

## 6. Thesis link

- **Phase:** P0 setup, before P2 and P3.
- **Serves:** the main rule of the super plan (every number comes from a command), the determinism contract (§2), and "do not look at test results while tuning" (§5).
- **Frozen values touched:** none. **Determinism class:** none (tooling). **Changes a reported number:** no.

---

## 7. Risks

- **Too strict, so work slows down.** H1 asks instead of refusing. Question 1 offers a light mode for tiny fixes.
- **A broken hook blocks all work.** The hook tests (check 2) catch this, and there is an off switch only you can set: an environment variable when you start Claude Code.
- **Hooks see only tool calls.** A shell command can still write a file in ways H3 does not catch. H3 catches the common ones (`sed -i`, `>` into a protected path); the rest depends on the written rules. We should not count on hooks alone.
- **Claude Code details** (hook output fields, the setting that lets only you run `/approve`, rule path scoping) must be checked against the current Claude Code docs during the design.

---

## 8. Open questions for you

1. **Light mode for XS bugs** such as B9: one file with a short spec, design and plan, and one approval? I recommend yes, for effort XS only.
2. **Folder names:** `2026-10-22-<slug>`, which sorts by date across the new year (my pick), or `22-10-<slug>` like today?
3. **Commits:** does approving a plan also approve the commits it lists? I recommend yes. Push still asks.
4. **Clean-up:** move the three `21-10-bugs-sweep-*` files into one `21-10-bugs-sweep/` folder, and delete the old `thesis` branch? Both need your OK.

---

## Review notes

(Filled in by the `gate-reviewer` once it exists. For this first task, the gates are run by hand.)
