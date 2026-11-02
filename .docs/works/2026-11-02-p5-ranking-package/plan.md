# Plan: Shared ranking package (@breadit/ranking)

Status: approved · 2026-11-02
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-02-p5-ranking-package/`

---

## How to read this plan

- **Where code goes.** New code goes in `packages/ranking/`. Changed: `apps/backend/src/posts/posts.service.ts` (one import, one deleted function), `apps/backend/package.json`, `apps/backend/Dockerfile`, `eval/package.json` plus one eval test, the root `package-lock.json`, and `.claude/hooks/verify.sh` (Step 9 only). Do not touch the frontend, the Prisma schema, migrations, `docs/`, `Latex/`, `.env`, or any other file in `.claude/`.
- **Needs:**
  - the pinned Node (`source ~/.nvm/nvm.sh`, then `nvm use` in the repo root; `node -v` must print the `.nvmrc` version);
  - Docker `db` and `redis` up for the backend integration tests (Steps 7 and 9);
  - Docker for `docker compose build` (Step 9).
- **Who does what.** Sonnet does Steps 1 to 9. Claude does "Claude's part" and the Acceptance. Sonnet does not edit `.docs/`, `CLAUDE.md` or `design.md`.
- **Rules for every step.**
  - Tests first: write the test, run it, see it fail for the right reason, then write the code.
  - Follow `.claude/rules/determinism.md` in `packages/ranking/`: no clock, no `Math.random`, every `.sort` with a compare function, no `localeCompare`. Import only `node:` modules in `packages/ranking/src`.
  - The signatures are those of blueprint §2.6 and of design "Code files". If one cannot be written that way, stop and report.
  - devDependencies use the backend's exact ranges (`typescript ^5`, `jest ^29.7.0`, `ts-jest ^29.4.15`, `@types/jest ^29.5.14`). If the lockfile gains any package other than the workspace links, revert and stop (design F11).
  - After `npm ci` or any install that rebuilds `node_modules`, run `npx prisma generate --schema=apps/backend/prisma/schema.prisma` before the backend tests (`npm ci` deletes the generated client).
  - If a step cannot be done as written, stop and report what and why. Do not work around it.
- **Commits** go on `test-app` and are never pushed. One commit per step, holding its own files and this `plan.md` (the ticks). Stage files by path; never stage `docs/supervisor-note.md`, `refs-manual/`, `datasets/` or `eval/data/`. End every commit message with a blank line and `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Approving this plan approves the commits listed.
- Effort scale (work size, not model effort): XS under 30 minutes, S under 2 hours, M half a day.

## Steps

#### Step 1: Package skeleton (effort XS)

- [x] Create `packages/ranking/package.json` (`@breadit/ranking`, 0.1.0, `main` `dist/index.js`, `types` `dist/index.d.ts`, scripts `build` and `test`), `tsconfig.json` (CommonJS, ES2021, strict, `src` only, test files excluded from the build) and `jest.config.js` (ts-jest, `src/**/*.spec.ts`) (design: Approach "A CommonJS package", Code files).
- [x] One placeholder spec so `test` runs. Install so the lockfile gets the link, and check that nothing else changed in it. `build` and `test` must exit 0 (DW1).
- [x] Commit: `build: packages/ranking workspace (@breadit/ranking)`

#### Step 2: Move the Explore score (package side) (effort XS)

- [x] Tests first (TC2): `explore.spec.ts` holds a verbatim copy of the old backend function as the reference, and a fixed table of inputs: all zero; large counts; fractional ages; an age that makes the score negative; a score exactly at a ×100 boundary. Every package value must equal the reference.
- [x] Write `src/explore.ts` with `computeExploreScoreFixed`, copied unchanged from `posts.service.ts`, and export it from `src/index.ts` by name (design F3, F4).
- [x] Commit: `feat: ranking computeExploreScoreFixed (moved, golden-tested)`

#### Step 3: Types and the AsOf rule (effort XS)

- [x] Tests first (TC6, part 1): `visibleAt` is true for `t < asOf.t`; for `t === asOf.t` only with an event id smaller than `beforeEventId`; false with no `beforeEventId`; false after. `ageHours` is `(asOf.t − createdAt) / 3600`.
- [x] Write `src/types.ts` (blueprint §2.6) and `src/asof.ts`.
- [x] Commit: `feat: ranking types and AsOf rule`

#### Step 4: Feature builders (effort S)

- [x] Tests first (TC6, part 2), on small hand-made arrays:
  - `userFeaturesAsOf`: followees and communities dated before `asOf.t`, distinct and sorted. A follow or membership at exactly `asOf.t` or later is out (design F10). `nByAuthor`, `nByCommunity` and `nTotal` count only the user's visible positives.
  - `postFeaturesAsOf`: counts by type, and `engagedBy` distinct and sorted, from visible positives only.
  - Adding any event after `asOf` changes neither result.
- [x] Write `src/features.ts` (design: Approach "Feature builders").
- [x] Commit: `feat: ranking as-of feature builders`

#### Step 5: `buildPool` (effort S)

- [x] Tests first (TC4):
  - **Window edges:** `createdAt` = `t − W` is in, `t` is out.
  - **Exclusions:** own posts, earlier positives, blocked authors, `deleted`, and `!isApproved` are all out.
  - **Cap:** only the newest `maxPosts` are kept, with `createdAt` ties going to the larger id.
  - **Order:** the output order is `(createdAt desc, id desc)`.
- [x] Write `src/pool.ts` (design: Approach "`buildPool`").
- [x] Commit: `feat: ranking buildPool`

#### Step 6: Scorers and `rankPool` (effort M)

- [x] Tests first (TC3, TC7):
  - **One case per method id.** There are 12 method ids. Use one small pool, with each expected `scoreFixed` computed by hand in the test's comments from the design's scorer table.
  - **Required cases:**
    - BL2t at `ageWeight` 0.25 equals BL2;
    - BL0 puts followee posts first;
    - BL4 and BL5 at the published `divisor` 45000 and `gravity` 1.8;
    - BL5 with zero likes gets `−2^31`;
    - H at `nTotal` = 0, where the prior spreads trust equally;
    - H with no followee and no community;
    - every method at `m` = 0 with an empty history returns a number, never NaN (F5);
    - BL6 equals H-follow with every trust weight 1;
    - the four H ablations.
  - **Errors.** `scorer` throws on an unknown method and on a missing param (F8).
  - **`rankPool`.** It gives `(scoreFixed desc, postId desc)` for any input order.
  - **Integers.** On random fixtures, every scorer returns `Number.isInteger` values.
  - **Grep test.** It scans `packages/ranking/src` (spec files excluded) for `Date.now`, `new Date()`, `performance.now`, `Math.random`, `.sort()`, `localeCompare`, and for any import not starting with `node:` or `./`.
- [x] Write `src/scorers.ts` and `src/rank.ts`, and export everything from `src/index.ts` by name (design: the scorer table and its notes).
- [x] Commit: `feat: ranking scorers BL0-BL6, H and ablations, rankPool`

#### Step 7: Backend uses the package (effort S)

- [ ] Add `"@breadit/ranking": "0.1.0"` to `apps/backend/package.json` dependencies, and install. Delete the private `computeExploreScoreFixed` from `posts.service.ts` and import it from `@breadit/ranking`. Change nothing else in the file (design: Approach "The backend change is one import").
- [ ] Build the package, then run the backend build, the unit tests and the integration tests (db and redis up). All must pass, including the Explore test in `counts.it-spec.ts`. Check that `grep` finds no definition of `computeExploreScoreFixed` in `apps/backend/src` (DW2).
- [ ] Commit: `refactor: backend Explore imports computeExploreScoreFixed from @breadit/ranking`

#### Step 8: Cross-check with the P3 pool rule (effort S)

- [ ] Add `"@breadit/ranking": "0.1.0"` to `eval/package.json` dependencies.
- [ ] Tests first (TC5): `eval/src/checks/pool-crosscheck.test.ts`.
  - Draw at least 200 random fixtures the way `buckets.test.ts` does (`rng(masterSeed, "bootstrap")`, inside the test only). Add no new stage name; `rng` accepts only the fixed names of blueprint §2.4.
  - Each fixture has posts with `createdAt` ties, own posts, earlier positives, a window and a small `maxPosts`.
  - For each fixture compare "the test post is in `buildPool`" with `inPool` from `eval/src/checks/buckets.ts`. They must be equal every time.
- [ ] The test imports `@breadit/ranking` by name from the ES module side (design F4).
- [ ] Commit: `test: eval cross-checks buildPool against the P3 pool rule`

#### Step 9: Build order (effort S)

- [ ] **Dockerfile.** Change `apps/backend/Dockerfile` as in design "Build order":
  - `deps` copies the package's `package.json`;
  - `builder` copies the package and builds it before the backend;
  - `runner` copies the package's `package.json` and `dist/` to the same paths.
- [ ] **`verify.sh`.** Add the steps "ranking build" and "ranking tests" after "shared build".
- [ ] **Run.** Run `bash .claude/hooks/verify.sh` with db and redis up; every check must pass. Run `docker compose build`; both images must build.
- [ ] Commit: `build: Docker and verify.sh build @breadit/ranking before the backend`

## Claude's part

- [ ] Read the commits and the diff against the design. Check the lockfile diff (links only).
- [ ] Acceptance items below, including the Docker stack check (DW9).
- [ ] **Docs:**
  - `CLAUDE.md`: an Overview line for `packages/ranking` (`@breadit/ranking`), and its build before the backend.
  - `.docs/implementation-plan.md` §2.6: the two feature-builder signatures, plus a change-log line.
  - `.docs/super-plan.md`: P5 part 1 status, the §4 row (`p5-ranking-package` ✅, P5 still open for the harness), and a change-log line.
  - `.docs/Bugs Report.md`: T4 marked "score part done in task 5; `Date.now()` in Explore goes in task 8".
  - Commit: `docs: close p5-ranking-package`.
- [ ] Fill in the Result, then close the task.

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | unit (package) | The package builds and its test command runs |
| TC2 | DW2 | unit (package) | `computeExploreScoreFixed` equals the old backend function on a fixed table |
| TC3 | DW3 | unit (package) | Each of the 12 method ids against hand-computed scores; the edge cases of design F5, F6, F7, F8 |
| TC4 | DW4 | unit (package) | `buildPool`: window, exclusions, cap, ties, order |
| TC5 | DW5 | unit (eval) | `buildPool` agrees with `inPool` on random fixtures; the ES module import works |
| TC6 | DW6 | unit (package) | `visibleAt`, `ageHours`, and the feature builders ignore later events |
| TC7 | DW7 | unit (package) | `rankPool` order, integer scores, grep for forbidden patterns and imports |
| TC8 | DW2, DW8 | unit + IT (backend) | The existing 99 unit and 108 integration tests pass after the switch, including the Explore IT test (needs db and redis) |

## Acceptance

- [ ] `npm ci` at the root, `npx prisma generate`, then build `@breadit/ranking` → all exit 0; the lockfile diff of the task holds only the new links (DW1)
- [ ] `grep` for `function computeExploreScoreFixed` in `apps/backend/src` → no match; the package's golden test passes (DW2)
- [ ] The package's tests → every method case, pool case, AsOf case and grep test passes (DW3, DW4, DW6, DW7)
- [ ] `npm run verify -w @breadit/eval` → the cross-check passes with the package imported by name (DW5)
- [ ] `bash .claude/hooks/verify.sh` with db and redis up → every check passes, with "ranking build" and "ranking tests" in the summary (DW8)
- [ ] `docker compose up --build` → both images build; `/api/health` answers 200; `GET /api/posts?feed=explore` answers 200 with posts; then stop the stack (DW9)
- [ ] `git diff --stat` of the task commits → only the DW10 files plus `eval/package.json` and `.docs/implementation-plan.md` (design note for DW10) (DW10)

## Result
