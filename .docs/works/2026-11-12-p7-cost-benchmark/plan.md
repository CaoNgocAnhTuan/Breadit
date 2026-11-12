# Plan: P7 cost benchmark (E7)

Status: done · 2026-11-12
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-12-p7-cost-benchmark/`

All commits go on `test-app` and are never pushed. Steps 2, 6 and the acceptance items need `docker compose up db redis -d` and `syn-W2M-M` loaded into `eval_load` without `--rebase-to`. Step 6 also needs k6 (installed: v1.7.1).

## Steps

- [x] 1. **Throttle limit (N6).** Write TC1 first and see it fail. Then add `apps/backend/src/throttle/throttle.config.ts` with `readThrottleLimit`, `THROTTLE_TTL_MS` and `DEFAULT_THROTTLE_LIMIT`, and use it in `ThrottlerModule.forRoot` in `apps/backend/src/app.module.ts`. Document `THROTTLE_LIMIT` (default, and that E7 raises it) in `.env.example` and `README.md`. (Design: Approach "Throttle limit"; Code files rows 1–3, `.env.example`, `README.md`.) Commit: `feat(backend): throttle limit from THROTTLE_LIMIT (N6)`

- [x] 2. **Prepare step (backend, Jest project `bench`).** Give `createTestApp` in `apps/backend/test/it/helpers/app.ts` an optional list of provider overrides; existing callers do not change. Add the project `bench` to `apps/backend/jest.config.js` (parity `env.ts` and `global-setup.ts`, plus `test/bench/env.ts`) and the script `bench:prepare` to `apps/backend/package.json`. Add `test/bench/counting-prisma.ts` and `test/bench/prepare.bench-spec.ts`. Write TC2 and TC3 inside the spec first, then the parts that write `queries-raw.csv`, `params.json` and `sessions.json` to the output folder (default `eval/results/p7-e7/`). Run the parity test and the IT tests once after the `createTestApp` change. (Design: Approach "Three steps", step 1, and "What the query count counts"; Code files `jest.config.js` to `app.ts`.) Commit: `test(backend): E7 prepare step (query count and sessions)`

- [x] 3. **Summary step (eval).** Write TC4 in `eval/src/bench/e7.test.ts` first. Then add `eval/src/bench/e7.ts` (`summarizeLatency`, `summarizeQueries`, `bootstrapMedian` on the stream `rng(masterSeed, "bootstrap-median")`), the CLI `eval/src/cli/e7-summary.ts` and the script `e7:summary` in `eval/package.json`. The CLI checks `params.json` against the params of `.docs/results/p6-parity/manifest.json` and writes `.docs/results/p7-e7/` with the existing CSV writer and manifest rules of the harness. (Design: Approach step 3; Code files `eval/src/bench/e7.ts` to `eval/package.json`.) Commit: `feat(eval): E7 summary (latency median with bootstrap CI, query counts)`

- [x] 4. **k6 script and runner.** Add `scripts/e7/feed.k6.js` and `scripts/e7/run-e7.mjs`, and the root script `bench:e7`. The runner does the checks first (k6, Docker, nothing on :4000, F2 and F10), calls `bench:prepare`, starts the backend with `run-safe.sh` (schema `eval_load`, cache off, `asOf` on, `THROTTLE_LIMIT` from `--throttle-limit`, Redis db 3, the same test `JWT_SECRET` as the prepare step), runs the rounds in rotated order, flushes Redis db 3 before each round, stops on the first failed request (F3), always stops the backend, writes `runs.csv` and `environment.json`, then calls `e7:summary`. (Design: Approach "Rounds", "What the latency measures"; Workflow diagram; Failure modes F2, F3, F6, F10; Code files `scripts/e7/*`, root `package.json`.) Commit: `feat: E7 k6 runner`

- [x] 5. **Report.** Write TC5 first: the fixture of `report.test.ts` gets a `p7-e7` folder, and the test expects the 15 E7 macros and the E7 table. Then add `p7-e7` to `REPORT_RUNS`, the `KEY_COLUMNS` of `latency.csv` and `queries.csv`, the E7 entries of `MACRO_SPECS` and `e7Table` in `buildTables`. Update the header text of `report.ts` and `results.md` ("the twelve P7 runs" becomes thirteen). (Design: Code files, `eval/src/report/*`.) Commit: `feat(eval): E7 macros and table in the report`

- [x] 6. **Run E7 and the report.** Run the E7 runner with its defaults on a quiet machine. Check that all 15 runs have 0 failed requests and that `.docs/results/p7-e7/` holds the files of DW3. Commit the results. Then run the report and check that `git diff` of `.docs/results/p7-report/` only adds E7 lines and the new table (DW6). Commit the report. If a run fails (F3), stop and report the round, the algo and the status codes; do not change the limit or the profile to make it pass. (Design: Workflow; Spec DW3, DW6.) Commits: `chore: p7-e7 results` and `chore: p7-report with E7`

- [x] 7. **Docs.** With the numbers of step 6:
  - `docs/System_Architecture.md`: E7 ✅ in the status table, and the sentence "E7 measures the cost" gets the result (macro names, not new numbers typed by hand where a macro exists).
  - `docs/Guidance-Manual/en/08-system-and-feed.md` §5.2 and `10-defense-qa.md`: the E7 answers lose "(after P7)" and give the result; then the same changes in `vi/`.
  - `.docs/Bugs Report.md`: N6 moves to the resolved list with the commit of step 1; the counts at the top change; the E7 row of the phase table says done. The T3 note: E7 ran with the cache off.
  - `.docs/super-plan.md`: P7 row (task 10 ✅), §7 row "k6 runs / load profile" gets the load profile the author confirmed at Design approval (Design: Decisions taken from the Spec, item 4), and a change-log line.
  - `.docs/implementation-plan.md` §5: task 10 ✅ with the date, task 11 becomes ▶ next.
  (Design: Code files, Docs row.) Commit: `docs: E7 done, N6 resolved`

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | unit (`apps/backend/src/throttle/throttle.config.spec.ts`) | Unset and empty give 1,000; `"5000"` gives 5,000; `abc`, `0`, `-1`, `1.5` and `" 7"` throw with a message that names `THROTTLE_LIMIT`. |
| TC2 | DW3 (the count is real) | bench (`apps/backend/test/bench/prepare.bench-spec.ts`, needs db, redis, `eval_load`) | A known request (pair 1, `chrono`) gives a query count above 0. This is the "not verified" point of the Design (query events in the subclass). |
| TC3 | DW4 | bench (same file) | Two full passes over 100 pairs × 3 algos give the same count for every (pair, algo); every response is 200; the written `queries-raw.csv` has 300 rows. |
| TC4 | DW3, DW5 | unit (`eval/src/bench/e7.test.ts`, `node --test`) | Warm-up rows are dropped; a run with `failed > 0` throws; fewer than 4 kept runs per algo throws; `bootstrapMedian` gives the same bytes twice and a known result on a small input; `summarizeQueries` gives the known mean, min and max. |
| TC5 | DW6 | unit (`eval/src/report/report.test.ts`, `macros.test.ts`) | With the `p7-e7` fixture, the report has the 15 E7 macros and the E7 table; every other macro is unchanged; a changed `latency.csv` makes `readRun` throw. |
| — | DW7 | parity (existing) | `test:parity` still passes after steps 1 and 2. |
| — | DW8 | all | `verify.sh` passes. |

## Acceptance

Claude does these after step 7, with the backend from `run-safe.sh` where needed, and stops it after.

- [x] DW2: backend on `eval_load` with `THROTTLE_LIMIT` set to the E7 value, 1,300 calls to `/api/posts` from one IP within a minute → no 429. Restart with `THROTTLE_LIMIT` unset → the 1,001st call in a minute gives 429.
- [x] DW2 (start rule): start the backend with `THROTTLE_LIMIT=abc` → it does not start, and the log names `THROTTLE_LIMIT`.
- [x] DW3: `.docs/results/p7-e7/` has `latency.csv` (3 algos), `queries.csv`, `runs.csv` (15 rows, 0 failed, round 1 marked warm-up) and `manifest.json` with the machine, versions, cache off, the throttle limit and the dataset hash.
- [x] DW4: run the prepare step a second time → `queries-raw.csv` is byte-identical to the first.
- [x] DW5: the runner with `--throttle-limit 50` → it stops with an error naming `http_req_failed`, the backend is stopped, and no new `latency.csv` is written (the committed one is unchanged).
- [x] DW6: `git diff` of `macros.csv` and `results-macros.tex` from step 6 → only added lines.
- [x] DW7: `test:parity` passes.
- [x] DW8: `verify.sh` passes.
- [x] DW9: `git diff` of the docs of step 7 → E7 done, no E7 "(after P7)" left in `en/` or `vi/`, N6 resolved with its commit.

## Result


Done on 2026-11-12. Implemented by Sonnet, then verified by Claude. All 7 steps and all 9 acceptance items pass.

**E7 result** (`.docs/results/p7-e7/`, Apple M1, page cache off, α = β = 1). Each value is the median of the 4 kept run medians, with its 95% bootstrap CI:
- `chrono`: 36.9 ms [35.4, 38.4], p95 43.0 ms.
- `engagement`: 36.3 ms [36.0, 36.8], p95 44.7 ms.
- `social`: 38.1 ms [36.4, 38.4], p95 45.9 ms.
- Queries per request: 19.65 / 19.63 / 19.65 on average, 17 to 21 for all three. `FeedService.rank` loads the same data for every `algo`; only the scorer differs.

All 15 runs had 0 failed requests. The whole run takes about 95 s. The load average was about 5 on 8 cores at the start (recorded in `environment.json`), so the machine was not quiet.

**Tests.** Backend unit 203 (14 new), bench 4, parity 102, IT 146, eval 411, ranking 85. `verify.sh`: all PASS.

**Commits.** `c5cdec4`, `6fa6ee9`, `f611e97`, `b5d3743`, `7ac7e5c`, `c74a3ff`, `6505a16`, `4aa8a2d`, plus the closing commit of this task.

**Acceptance.**
- DW2: with `THROTTLE_LIMIT=1000000`, 1,300 calls gave no 429. With it unset, the first 429 came at call 1,001. `abc` stops the app with an error that names `THROTTLE_LIMIT`.
- DW4: a rerun of the prepare step gave the same `queries-raw.csv` SHA-256 (`884975…`).
- DW5: `--throttle-limit 50` exits 1 with "50 of 100 requests failed … 429 x 50". The backend is stopped, and the committed results do not change.
- DW6: `macros.csv` and `results-macros.tex` only gained lines (30).

**Differences from the plan.**
1. **Pool pings are not counted.** `CountingPrisma` ignores the statement `SELECT 1`. Without this rule, two passes differed by 1 to 3 queries on 3 of the 300 requests (F8). Prisma's connection pool sends these pings itself, and the app never sends `SELECT 1` (no raw query in `apps/backend/src`).
2. **New PRNG stage name.** `bootstrap-median` was added to `STAGE_NAMES` in `eval/src/rng.ts`, to its test, and to `.docs/implementation-plan.md` §2.4. The design did not list `rng.ts`.
3. **Extra summary file.** The summary logic is in `eval/src/bench/write.ts`, with `write.test.ts`, following the pattern of `parity/write.ts`.
4. **Runner details.** The runner builds `@breadit/shared` and `@breadit/ranking` first, and stops only a backend it started itself.
5. **Report.** `buildTables` now gives ten tables, and `results.md` says "thirteen runs".

**Open.**
- `CLAUDE.md` does not mention `bench:e7`, `bench:prepare`, `e7:summary` or `THROTTLE_LIMIT` yet. It was left for the author.
- A rerun on a quiet machine is optional.
