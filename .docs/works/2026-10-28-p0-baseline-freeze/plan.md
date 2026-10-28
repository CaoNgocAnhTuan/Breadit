# Plan: P0 baseline freeze: pin Node and Docker images

Status: approved · 2026-10-28
Design: [design.md](design.md) · Folder: `.docs/works/2026-10-28-p0-baseline-freeze/`

---

## How to read this plan

- This task changes configuration only: no TypeScript source, no Prisma schema, no migration.
- **Needs:** Docker with `db` and `redis` up (`docker compose up db redis -d`), network access (Docker registry, nvm download, npm), nvm at `~/.nvm` (in a non-interactive shell, load it from `~/.nvm/nvm.sh` before `nvm` works).
- **Who does what.** Sonnet does Steps 1 to 7. Claude does "Claude's part" and the Acceptance. Sonnet does not touch `.docs/super-plan.md`.
- **Rules for every step.**
  - Run every Node command, and every commit (the husky hook runs the typecheck), under the pinned Node after Step 3 (`nvm use` in the repo root).
  - Never write to schema `public` or `it_test`. Never `down -v`, never `prisma migrate reset`, never `db push`.
  - Do not change any dependency version. If the lockfile changes beyond the root `engines` block, revert it and stop (design F3).
  - If Prisma or `sharp` fails on the new image (design F1, F2), stop and report. Do not add `binaryTargets` or change the schema.
  - Do not change `design.md`, the rest of `plan.md`, `.env`, `docs/`, `Latex/` or `.claude/`.
- **Commits** go on `test-app` and are never pushed. A step's commit holds its own files and this `plan.md` (the ticks). Stage files by path; do not stage `docs/supervisor-note.md` or `refs-manual/`. End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: `check_pins.sh`, first (effort S)

- [x] Write `check_pins.sh` in the task folder (design §3 Approach, part 4): the seven checks `nvmrc`, `engines`, `from-pinned`, `from-same`, `compose-pinned`, `image-node`, `local-node`, one PASS or FAIL line each, a `--no-docker` option that skips `image-node`, exit 0 only when all that ran pass. Read-only.
- [x] Run it on the current repo. Every check must FAIL (TC1). If one passes, the check is wrong: fix the script, not the repo.
- [x] Commit: `chore: P0 check_pins.sh (fails before the pins)`. This commit also adds `design.md` and `plan.md`.

#### Step 2: `check_clean_clone.sh` (effort S)

- [x] Write `check_clean_clone.sh` in the task folder (design §3 Approach, part 5, steps 1 to 9): the Node check, the `public` counts, the fresh clone in `$TMPDIR`, `npm ci`, migrate deploy and seed into schema `p0_clean`, shared build, typecheck, the 19-row check of `_prisma_migrations`, drop of `p0_clean`, the second count and compare, removal of the clone, and the `--engine-test` option with Node v24.14.1.
- [x] The schema name is a constant. The script refuses `public` and `it_test` (TC4).
- [x] Run it now: it must stop at its first step, because there is no `.nvmrc` yet (TC3). Do not run the rest before Step 4.
- [x] Commit: `chore: P0 check_clean_clone.sh`

#### Step 3: The pins (effort S)

- [x] Resolve the multi-arch **index** digest of `node:22-alpine` and of the Dockerfile syntax image (`docker/dockerfile:1.7`) (design §3 part 1). Check that each is an index (a manifest list), not a single-platform manifest (design F8). Run `node -v` and `npm -v` inside the pinned Node image and note both.
- [x] Write `.nvmrc` with that `node -v`. Install and use it with nvm.
- [x] Root `package.json`: add `engines` (design §3 part 2). Refresh the lockfile with the lockfile-only install and `--legacy-peer-deps`. Check the diff of `package-lock.json`: only the root `engines` block may change (F3).
- [x] Add `.npmrc` with `engine-strict=true`, then run `npm ci` in the repo under the pinned Node. If it stops with `EBADENGINE`, remove `.npmrc` and note it for the report (F4).
- [x] Both Dockerfiles: the `# syntax=` line and the three `FROM` lines get the full pinned reference (design §3 part 3). `docker-compose.yml`: `db` and `redis` get the digests in design §3 part 1.
- [x] Run `check_pins.sh`. All seven checks PASS (TC2).
- [x] Commit: `build: pin Node 22 and the base images by digest (P0)`. The message body lists the three digests and the date they were taken (2026-10-28).

#### Step 4: Clean clone and engine test (effort S)

- [x] Run `check_clean_clone.sh --engine-test`. Every clean-clone step exits 0, `_prisma_migrations` in `p0_clean` has 19 finished rows, `p0_clean` is dropped, and the `public` counts are equal before and after (TC5, TC6). Note whether `npm ci` under Node 24 stopped with `EBADENGINE` (TC7, F5).
- [x] Save the script output as `clean_clone_output.txt` in the task folder.
- [x] Commit: `chore: P0 clean-clone check output`

#### Step 5: Tests and the full stack (effort S)

- [ ] Under the pinned Node, with `db` and `redis` up, run `bash .claude/hooks/verify.sh`. Every check passes (TC8). Save the summary lines for the report.
- [ ] Run `docker compose up --build -d`. Both images build. When the backend is healthy, `/api/health` answers 200 (TC9). Count the `public` rows of `User`, `Post`, `Like`, `Follow` and compare with Step 4 (F7).
- [ ] Stop the `backend` and `app` containers afterwards, so ports 4000 and 3000 are free for local work. Leave `db` and `redis` running. Do not remove volumes.
- [ ] No commit in this step unless a file changed (none should).

#### Step 6: CLAUDE.md (effort XS)

- [ ] Add one line at the top of the "Commands" code block in `CLAUDE.md` (design §3 part 7).
- [ ] Commit: `docs: CLAUDE.md, nvm use for the pinned Node`

#### Step 7: Report (effort XS)

- [ ] Stop. Report to Claude: the commits, the Node version and the three digests, whether `.npmrc` stayed, the engine-test result, the `check_pins.sh` and `check_clean_clone.sh` results, the `verify.sh` summary with test counts, the Docker result, and anything you could not do as written and why. Do not work around a step that cannot be done as written.

### Claude's part (after Step 7)

- [ ] Record the SHA-256 of super-plan §5, §6 and §7 before the edit.
- [ ] Do the Acceptance items below.
- [ ] Edit `.docs/super-plan.md`, P0 only (design §3 part 7): Node 22 and why, the "Done when" on Node 22, a P0 status paragraph with the versions and digest date, header version 0.13, a change-log line. Compare the three hashes again.
- [ ] Commit: `docs: super-plan 0.13, P0 baseline freeze done`

## Tests

The "tests" of a configuration task are the two check scripts and the project checks.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1, DW2, DW3 | script | `check_pins.sh` on the repo before Step 3: every check FAILs |
| TC2 | DW1, DW2, DW3 | script | `check_pins.sh` after Step 3: all seven PASS, including `image-node` (Node in the image equals `.nvmrc`) and `local-node` |
| TC3 | DW4 | script | `check_clean_clone.sh` before Step 3 stops at the Node check and touches nothing |
| TC4 | DW5 | script | The script refuses to run with the schema set to `public` or `it_test` (tested by changing the constant in a copy, or by a guard function called with those names) |
| TC5 | DW4 | script | Fresh clone on the pinned Node: `npm ci`, migrate deploy (19 migrations), seed, shared build, typecheck all exit 0 |
| TC6 | DW5 | script | `public` counts of `User`, `Post`, `Like`, `Follow` equal before and after; `p0_clean` no longer exists |
| TC7 | DW2 | script | `npm ci` under Node v24.14.1 in a fresh clone: stops with `EBADENGINE` if enforced, else the result is recorded as "warn only" |
| TC8 | DW6 | unit and IT | `verify.sh`: shared build, frontend typecheck and lint, backend build, backend unit tests, integration tests (schema `it_test`, Redis db 1) |
| TC9 | DW7 | Docker | Both images build on the pinned images, the backend runs `migrate deploy`, `/api/health` answers 200 |

## Acceptance

Claude checks these after Step 7.

- [ ] DW1: `.nvmrc` holds one exact version, and `node -v` in the pinned image equals it (Claude reruns `check_pins.sh`) → pass.
- [ ] DW2: the root `package.json` has `engines.node` for the Node 22 major. The engine-test result is recorded (stop or "warn only") → pass.
- [ ] DW3: every `FROM`, `# syntax=` and `image:` line has a tag and `@sha256:` with 64 hex characters. Claude checks by hand that the Node and syntax digests are index digests → pass.
- [ ] DW4: `clean_clone_output.txt` shows every clean-clone step with exit 0 and 19 migrations → pass.
- [ ] DW5: the `public` counts are equal in the output, `p0_clean` does not exist in the dev Postgres, and the counts after Step 5 are still equal → pass.
- [ ] DW6: Claude reruns `verify.sh` under the pinned Node and every check passes → pass.
- [ ] DW7: the Step 5 report shows both images built and `/api/health` 200. Claude checks the running images are the pinned digests → pass.
- [ ] DW8: `git diff --stat` over the task commits lists only the files of design §3 "Code files" (plus `clean_clone_output.txt`) → pass.

## Result

