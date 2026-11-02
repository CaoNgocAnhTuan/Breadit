# Plan: Seeded synthetic generator and eval workspace

Status: approved · 2026-11-02
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-02-p3-synthetic-generator/`

---

## How to read this plan

- **New code only.** Everything goes into the new `eval/` workspace, plus the root `package.json`, `package-lock.json` and `.gitignore`. Do not touch `apps/`, `packages/`, the Prisma schema, `docs/`, `Latex/`, `.env` or `.claude/`.
- **Needs:** the pinned Node. In a non-interactive shell, load nvm from `~/.nvm/nvm.sh`, then `nvm use` in the repo root, so `node -v` prints the `.nvmrc` version. The default shell has v22.14.0, and `.ts` files do not load on it (design F1). Every Node command and every commit (the husky hook runs the frontend typecheck) runs under the pinned Node. No Docker and no network are needed for Steps 1 to 9.
- **Who does what.** Sonnet does Steps 1 to 13 (Steps 10 to 13 come from design §4, Amendment 1). Claude does "Claude's part" and the Acceptance. Sonnet does not edit `.docs/super-plan.md`, `.docs/Bugs Report.md`, `CLAUDE.md` or `design.md`.
- **Rules for every step.**
  - Tests first: write the test, run it, see it fail for the right reason, then write the code.
  - Follow `.claude/rules/determinism.md`: no `Date.now`, `new Date()` with no argument, `performance.now`, `Math.random`, `crypto.randomUUID`, `localeCompare`, `toLocaleString`, `Intl`, and no `.sort()` without a compare function. The post-edit hook reports them.
  - No `enum`, `namespace` or constructor parameter properties (type stripping, design Approach). Relative imports end in `.ts`.
  - No runtime dependency. The only devDependencies are `typescript ^5` and `@types/node ^20` (the same ranges as the backend). If `npm install` changes any other package in `package-lock.json`, revert and stop.
  - Every frozen number is read from `eval/config/frozen-v1.json`. Never type a §7 number into code.
  - If a step cannot be done as written, stop and report what and why. Do not work around it.
- **Commits** go on `test-app` and are never pushed. A step's commit holds its own files and this `plan.md` (the ticks). Stage files by path; never stage `docs/supervisor-note.md`, `refs-manual/`, `datasets/` or `eval/data/`. End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale: XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: The workspace (effort XS)

- [x] Create `eval/package.json` and `eval/tsconfig.json` (design: Code files). Scripts: `test` (all `src/**/*.test.ts` with `node --test`), `typecheck` (`tsc --noEmit`), `verify` (typecheck, then test; `.claude/hooks/verify.sh` already runs `npm run verify -w @breadit/eval` when this script exists), `gen` and `check` (the two CLIs of Step 8).
- [x] Add `"eval"` to the root `workspaces`. Add `eval/data/` and `eval/node_modules/` to `.gitignore`. Run the install so `package-lock.json` gets the workspace link, and check that no other package changed.
- [x] Add one placeholder test so `test` and `verify` run and pass. Step 2 replaces it.
- [x] Commit: `build: eval workspace (@breadit/eval)`

#### Step 2: Frozen values and the Node check (effort S)

- [x] Tests first (TC3): `src/frozen.test.ts` reads the §7 table of `.docs/super-plan.md` by row name and compares "Master seed", "Base epoch" (as integer seconds since the Unix epoch and as the ISO string), "Dataset sizes" (S and M users and posts), "History buckets", and "Window W / pool cap N_max" with `frozen-v1.json`. Also test that `checkNode()` throws when the version differs from `.nvmrc` (pass the version in, so the test does not depend on the real Node).
- [x] Write `eval/config/frozen-v1.json` and `eval/src/frozen.ts` with `loadFrozen()` and `checkNode()` (design: Approach "One source for the frozen values", F1, F3).
- [x] Commit: `feat: eval frozen values checked against super-plan §7`

#### Step 3: The RNG (effort S)

- [x] Tests first (TC2): equal seed and stage give equal sequences in two child processes (1,000 values); `users` and `follows` give different sequences; `float()` is in [0, 1); `int(n)` stays in [0, n) and rejects `n` ≤ 0; a stage name outside the list of blueprint §2.4 is a type error and a runtime error; a known-answer vector of the first 8 `next()` values of `rng(masterSeed, "users")`.
- [x] Write `eval/src/rng.ts` (design: Code files, `rng.ts`): sfc32, state from the first 16 bytes of `sha256("<masterSeed>:<stage>")` read as four big-endian uint32 (a, b, c, counter), first 12 outputs dropped, `int(n)` by rejection.
- [x] Get the known-answer vector from a separate Python sfc32 (`sfc32_check.py` in this task folder, standard library only, run with `python3 -I`). The TS and Python values must be equal before the vector goes into the test.
- [x] Commit: `feat: eval rng (sfc32 seeded from sha256, one stream per stage)`

#### Step 4: Canonical files (effort S)

- [x] Tests first (TC4): `writeTable` sorts by the keys of blueprint §2.2, writes a header, LF, UTF-8, no trailing spaces, and an empty `community_id` as empty; it throws on a non-integer id or time, on a missing column and on an unknown table. `readTable` reads back the same rows. `writeManifest` gives sorted keys, two-space JSON and a final LF, with the keys of blueprint §2.3 (`schemaVersion`, `datasetId`, `source`, `masterSeed`, `epoch`, `node`, `files`). The SHA-256 in `files` equals the SHA-256 of the file on disk.
- [x] Write `eval/src/canonical/schema.ts`, `csv.ts`, `manifest.ts` (design: Code files).
- [x] Commit: `feat: eval canonical CSV and manifest writers`

#### Step 5: The four checks (effort M)

- [x] Tests first, each on a small hand-made fixture folder written by the Step 4 writer (TC5 to TC8):
  - **format** (TC5): passes on a good fixture. Fails, one case each: self-follow, repeated follow pair, interaction on an unknown post, interaction at the same second as or before its post, interaction on one's own post, community post by a non-member or by a member who joined after `created_at`, unsorted rows, a CRLF line, a file not listed in the manifest, a SHA-256 that differs from the manifest.
  - **calibration** (TC6): mean and median per user and the top-20% share on a fixture with known answers. Users with no action are not counted. Pass and fail at the tolerance edges (10% of the target, 5 points for the skew).
  - **lift** (TC7): on a fixture where every action falls on an exposed post the lift is above 1. On a fixture with no follows it is not computed and the report says so. A follow dated at or after the action does not count.
  - **buckets** (TC8): port the cases of `.docs/works/2026-10-28-p2-implementation-blueprint/test_check_cut_time.py` that apply to canonical data (cut time at rank `ceil(q·n)` with exact integer math, the event at T is validation, last event after T is the test item, time ties broken by event id, history counts strictly earlier events, bucket edges and the union 0–4, window edges, own and earlier posts out of the pool, only the newest N_max, `created_at` ties to the larger post id, the brute-force comparison on random fixtures drawn from `rng`).
- [x] Write `eval/src/checks/format.ts`, `calibration.ts`, `lift.ts`, `buckets.ts` (design: Approach "Checks read only the canonical files"). Calibration targets come from `synthetic-v1.json` (`target` fields), so the checks hold no Digg number of their own.
- [x] Commit: `feat: eval checks (format, calibration, lift, buckets)`

#### Step 6: The config and the stages (effort M)

- [x] Tests first (TC9), one per stage on a tiny config (for example 30 users, 120 posts): `users` (ids `1..N`, joined times inside the time range, the late-joiner share), `follows` (no self-link, no repeat, the list share, dated after both users joined, homophily 0 gives no link between similar users above chance in a large draw), `communities` (one per topic, memberships after `joined_at`), `posts` (ids follow `(created_at, author_id, draw order)`, D1 holds), `interactions` (strictly after the post, never one's own post, never a repeated pair, influence 0 makes `S(u, p, t)` have no effect: two configs that differ only in a γ with no follows give the same rows).
- [x] Write `eval/config/synthetic-v1.json` with the start values of the design table "Parameters", each with `kind` and, when calibrated, `target` (the §6a value and row name). Write `eval/src/generator/config.ts` and the five stage files (design: Approach "The generator", the weight formula, "Parameters").
- [x] Commit: `feat: eval generator stages and synthetic-v1 config`

#### Step 7: Generate a dataset (effort S)

- [x] Tests first (TC10, TC11): `datasetIds()` returns the eight ids of the design, in a fixed order. `generateDataset` run twice on `syn-W2M-S` into two fresh temporary folders gives byte-identical `manifest.json` files and CSV files (DW3). `syn-W1-S` and `syn-W2M-S` have identical `users.csv`, `follows.csv`, `communities.csv`, `memberships.csv` and `posts.csv` (shared streams). The generator deletes and rewrites the dataset folder and refuses a path outside the out dir (F10).
- [x] Write `eval/src/generator/generate.ts`.
- [x] Commit: `feat: eval generateDataset (eight synthetic datasets)`

#### Step 8: The two commands and the grep test (effort S)

- [x] Tests first (TC12): a test that scans every `.ts` file under `eval/src` for the forbidden patterns of the determinism rule and fails on a match without `// harness-allow:` (DW8). The test file's own pattern list is the only allowed exception.
- [x] Write `eval/src/cli/generate.ts` (out dir argument, default `eval/data`; one line per dataset with id, row counts and manifest SHA-256) and `eval/src/cli/check.ts` (data dir argument; checks each dataset as in the design's Check diagram; exit 1 on any failure). Both call `checkNode()` first.
- [x] Commit: `feat: eval gen and check commands`

#### Step 9: Generate, check and calibrate (effort M)

- [x] Run `gen` into `eval/data`, then `check`. Read the report: format (all eight), calibration (the M datasets), lift order (DW7), buckets for `syn-W2M-M` (DW6).
- [x] If calibration fails (design F5), change only the parameter whose target failed, in `synthetic-v1.json`. If buckets fail (F6, F7), change only a value marked `chosen` (late joiners, τ, span). Never change a homophily or influence value to pass DW7: if the lift order is wrong, stop and report (it is a bug). At most 5 rounds; if a check still fails, stop and report the last output.
- [x] Write each change (parameter, old value, new value, why) in a short list at the end of the Step 9 report, for the Result section.
- [x] Run `gen` a second time into a second folder outside the repo and compare the eight manifests with the first run (DW3).
- [x] Save the final `check` output, with the SHA-256 of each manifest and of `synthetic-v1.json`, as `check_output.txt` in this task folder.
- [x] Commit: `chore: P3 synthetic data generated and checked`

#### Step 10: New calibration values and the bucket 0 line (effort S)

- [x] Tests first (TC13): `calibration.ts` measures the 90th and 99th percentiles (nearest rank), the four shares of users by action count, the share of users with at least one followee, and the top user's share of all actions, with the tolerances of design §4 "Changed Spec". The share limit fails when one user is above `maxUserActionShare`. In `run.ts`, the bucket check fails when bucket 0 has no kept test user (TC14).
- [x] Change `eval/src/checks/calibration.ts` and `eval/src/checks/run.ts` (design §4 "Checks").
- [x] Commit: `feat: eval calibration adds percentiles, bins, list share and the user cap`

#### Step 11: Activity model (effort S)

- [x] Tests first (TC15): on a large tiny-config draw (for example 20,000 users), the four bin shares are within 1 point of the config; every count is at least 1; no count is above the cap; counts in 2–4 and 5–19 fall with `k`. Stage 5 gives each user exactly their count, minus skipped actions, and no longer calls `allocate`.
- [x] Change `eval/src/generator/users.ts`, `interactions.ts`, `config.ts`, and the config params `activityTailAlpha`, `activityBinShares`, `maxUserActionShare` (design §4 "Activity", "Config"). Remove `activityParetoAlpha`.
- [x] Commit: `feat: eval activity counts drawn by Digg bins with a capped tail`

#### Step 12: Follow rule and span (effort XS)

- [ ] Tests first (TC16): a user without a list has no followee; a returned link always goes to a user with a list; the share of users with a followee equals the share of list holders.
- [ ] Change `eval/src/generator/follows.ts`. In `synthetic-v1.json`: `followListShare` becomes calibrated (target 51.19%, `.docs/datasets.md` §4), `followeesMean` start 19.4, `spanDays` 80 (design §4 "Follows", "Span").
- [ ] Commit: `feat: eval returned links only between list holders, span 80 days`

#### Step 13: Generate, check and calibrate again (effort M)

- [ ] Same as Step 9, with the DW5 and DW6 of design §4. Calibration may move only `activityTailAlpha`, `followeesMean` and `followListShare`. Buckets may move only `lateJoinerShare`, `freshnessTauHours` or `spanDays`. At most 5 rounds, then stop and report. Never change homophily or influence.
- [ ] Report the top user's share, the number of users at the cap, the bucket 0 count and the median pool size, with every parameter change.
- [ ] Two runs into two folders: all eight manifests equal. Replace `check_output.txt`.
- [ ] Commit: `chore: P3 synthetic data regenerated after amendment 1`

## Claude's part

- [ ] Read the commits and the diff against the design. Check that `package-lock.json` changed only by the workspace link.
- [ ] With Docker db and redis up: `bash .claude/hooks/verify.sh` (it now also runs `eval verify`) and `docker compose build` (DW9). If `npm ci` fails in a Dockerfile (design F4), add `COPY eval/package.json ./eval/` next to the `packages/shared` line in both Dockerfiles, build again, and commit `build: Dockerfiles copy the eval workspace manifest`.
- [ ] Docs: one line in `CLAUDE.md` "Commands" for `gen`, `check` and `test` of `@breadit/eval`, after `nvm use`. `.docs/Bugs Report.md`: D1 decided on 2026-10-28 (membership required, product rule in task 8), out of "Open decision", and the count line. `.docs/super-plan.md`: the P3 status paragraph (`p3-synthetic-generator` done, `p3-postgres-loader` still open), the §7 row "Synthetic world parameters" gets the SHA-256 of `synthetic-v1.json` (design Open question 5: approving this plan freezes it), the status table in §4 (P3 stays ⬜ until the loader is done, the task gets ✅), and a change-log line. Commit: `docs: close p3-synthetic-generator, freeze synthetic-v1`.
- [ ] Fill in the Result, then close the task.

## Tests

All tests are unit tests in `eval/src/**/*.test.ts`, run by `node --test` under the pinned Node. None needs Docker, Postgres or Redis.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | unit | `npm ci` at the root and the `@breadit/eval` `verify` script exit 0 |
| TC2 | DW2 | unit | RNG: same seed and stage give the same values across processes, stages differ, known-answer vector equal to the Python sfc32 |
| TC3 | DW1, F1, F3 | unit | `frozen-v1.json` equals super-plan §7; `checkNode` rejects another version |
| TC4 | DW4 | unit | Canonical writer and manifest: sort order, LF, integers, keys, SHA-256 |
| TC5 | DW4 | unit | Format check catches each broken rule |
| TC6 | DW5 | unit | Calibration numbers and the tolerance edges |
| TC7 | DW7 | unit | Lift: exposed, no follows, follow dated too late |
| TC8 | DW6 | unit | Bucket count matches the P2 Python cases and a brute force |
| TC9 | DW4 | unit | Each stage keeps its rules, D1 holds, γ = 0 has no effect |
| TC10 | DW3 | unit | Two runs of `syn-W2M-S` are byte-identical |
| TC11 | design Approach | unit | `syn-W1-S` and `syn-W2M-S` share the first four stages' files; F10 folder rules |
| TC12 | DW8 | unit | No forbidden pattern in `eval/src` |
| TC13 | DW5 (amended) | unit | New calibration values, tolerances and the user cap |
| TC14 | DW6 (amended) | unit | Bucket check fails when bucket 0 is empty |
| TC15 | DW5 (amended) | unit | Activity counts follow the bins, at least 1, at most the cap |
| TC16 | DW5 (amended) | unit | No followee without a list; returns only between holders |

## Acceptance

- [ ] `npm ci` at the root, then `npm run verify -w @breadit/eval` under the pinned Node → both exit 0 (DW1)
- [ ] `check` on `eval/data` → format passes for all eight datasets (DW4)
- [ ] Two `gen` runs into two empty folders → every `manifest.json` pair has the same SHA-256 (DW3)
- [ ] Calibration table for the five M datasets → every calibrated value of design §4 within its tolerance, and no user above `maxUserActionShare` (DW5, amended)
- [ ] Bucket table for `syn-W2M-M` at `q` = 0.8 → at least 100 kept test users in bucket 0–4, and at least one in bucket 0 (DW6, amended)
- [ ] Lift per M world → W0 lowest, and W2L < W2M < W2H (DW7)
- [ ] grep `eval/src` for the forbidden patterns → no match without `// harness-allow:` (DW8)
- [ ] `bash .claude/hooks/verify.sh` with db and redis up, and `docker compose build` → all pass (DW9)
- [ ] `git diff --stat` from the commit before Step 1 → only the files listed in DW10 (DW10)
- [ ] `check` with the default shell Node (v22.14.0) → it stops and writes no file (it cannot load `.ts` there). `checkNode` covers another 22.x that can load `.ts` (TC3) (F1)

## Result
