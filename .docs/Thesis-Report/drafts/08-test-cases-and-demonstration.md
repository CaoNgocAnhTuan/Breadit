# Chapter 8. Test Cases and Demonstration

> **Draft, 2026-11-22.** Budget: about 9 pages. This chapter has no experiment result: every result is in Chapter 6. Test counts are facts and are typed. Every file, command and count was checked against the repository on 2026-11-22; where each count comes from is in the notes at the end. Remove this box and the notes at the end before the final version.

This chapter shows how we know that the platform works. Section 8.1 summarizes the test levels in one table. Section 8.2 describes the twelve test cases that matter most for the thesis. Section 8.3 says what the tests and the checks found. Section 8.4 shows the demonstration with eight screenshots. Chapter 5 says how the tests run, and Appendix A lists every test suite.

## 8.1 Test strategy and summary

The strategy has four parts.
- The ranking code is pure, so it is tested without a database: the same input must give the same output.
- The app is tested as a whole on a real PostgreSQL and a real Redis. The integration tests start the real app, and the Socket.IO tests connect real clients.
- One test ties the two parts together. The parity test checks that the live feed gives the same order as the evaluation harness (test case TC-07).
- The frontend has no automatic test. It is checked by hand in Chrome, and at the end by the rehearsal of the demo.

Table 8.1 gives one row for each level.

**Table 8.1. The test levels, with the counts of 2026-11-22.**

| Level | What it checks | Tool and command | Tests | Result |
|---|---|---|---|---|
| Ranking unit tests | The pure ranking code: the as-of rule, the pool, the features, the 13 scorers, the final sort, the Explore score, and the ban on clock and randomness | Jest, `packages/ranking`; `npm run test -w @breadit/ranking` | 85 in 7 suites | 85 pass |
| Backend unit tests | Services, guards, the feed module (options, cursor, constants, mapping), the gateway and the input rules; Prisma and Redis are test doubles | Jest project `unit`; `npm run test -w @breadit/backend` | 211 in 18 suites | 211 pass |
| Backend integration tests | The real app on a real Postgres schema (`it_test`) and Redis database 1: feeds, visibility, input errors, counts, socket authentication | Jest project `it`, `apps/backend/test/it/`; `npm run test:it -w @breadit/backend` | 171 in 14 files | 171 pass |
| Parity test | The live order equals the harness order: `syn-W2M-M`, 100 pairs of a user and a time, 3 `algo` values | Jest project `parity`; `npm run test:parity -w @breadit/backend` | 102 | 102 pass |
| Evaluation checks | The type check, then the tests of the evaluation code: generator, Digg adapter, harness (golden, leakage, double run), loader, report, manifests | `npm run verify -w @breadit/eval` (`tsc`, then `node --test`) | 434 in 43 files | type check clean, 434 pass |
| Demo helper tests | The helpers of the demo script: the start time, the choice of the two users, the comparison of feeds | `node --test scripts/demo/lib.test.mjs` | 22 | 22 pass |
| HTTP and Socket.IO replay | The curl checks of the bug sweep against a running backend, and the Socket.IO checks | `bash scripts/verify-bug-sweep.sh`, which runs `scripts/verify-socket.cjs` | 95 checks (11 on sockets) | 95 pass |
| Manual UI sweep | Every page and every user flow, driven in Chrome (record `.docs/works/2026-11-20-p10-demo-sweep/sweep.md`) | Chrome | 28 pages, 15 flows | 15 flows pass; 24 pages pass, 4 fail (2 are V1, fixed since; 2 are T6, open) |
| Demo rehearsal | The steps of the demo checklist on the demo data (record `.docs/works/2026-11-22-p10-demo-script/rehearsal.md`) | Chrome and a script | 9 steps | 9 pass |

The first six rows are automatic tests: 1,025 tests in all, and all of them pass. The replay, the sweep and the rehearsal are checks that a person starts, so we count them apart. The parity test and the integration tests need `docker compose up db redis -d`, and the parity test also needs `syn-W2M-M` loaded into the schema `eval_load`.

Two things are not tested. No test measures the speed of the feed or the delay of a socket message. The cost of one feed page is measured in experiment E7 (Section 6.12), and the thesis sets no delivery time target (NFR4). And there is no browser test suite, so the frontend is covered only by what a person sees in Chrome.

## 8.2 Selected test cases

Table 8.2 lists twelve test cases. Each one guards a claim of the thesis: the evaluation is correct and repeatable, the live feed is the evaluated feed, and the real-time and admin parts of the platform work. The IDs TC-01 to TC-12 are used only in this chapter. The column "File and test" gives the file and the name of the test, so that the test can be found. Every case passed on 2026-11-22.

**Table 8.2. Twelve selected test cases.**

| ID | Purpose | Steps | Expected result | File and test | Result |
|---|---|---|---|---|---|
| TC-01 | The ranking code uses no clock and no random source | Search every source file of `packages/ranking` for nine patterns (`Date.now`, `new Date()`, `Math.random`, `localeCompare`, `.sort()` without a compare function and others) and for any import that is not a `node:` module or a file of the package | No match | `packages/ranking/src/determinism.spec.ts`, "has no forbidden pattern and no import outside node: modules and ./ files" | Pass |
| TC-02 | The harness computes the right ranks and metrics | Run all 13 methods on the golden dataset (9 users, 12 posts, 33 likes, comments and reposts); compare the ranks of users 4, 1 and 7 with a table worked out by hand, and the result files with committed files | Ranks and metrics equal the hand work; files equal byte for byte | `eval/src/harness/run.test.ts`, "golden: ranks of users 4, 1 and 7 equal the hand work" and "golden: the validation CSV files equal the committed expected files byte for byte" | Pass |
| TC-03 | No leakage: the future never changes a ranking | For each user, delete, change or stuff with new events everything after the user's test item, and rank again | The rows of that user do not change (all golden users, and 30 users of `syn-W2M-S`) | `eval/src/harness/run.test.ts`, "leakage, golden …" and "leakage, syn-W2M-S: 30 users …" | Pass |
| TC-04 | The fast harness equals the slow reference | Compute the features with the fast index and with the reference code that visits every event, on the golden dataset and on `syn-W2M-S` | The `per_user` rows are byte-identical | `eval/src/harness/run.test.ts`, "fast and reference modes give byte-identical per_user rows" | Pass |
| TC-05 | A run can be repeated (the double run) | Run one config into two empty folders | Every file, the manifest included, is byte-identical | `eval/src/harness/commands.test.ts`, "harness runs a config into --out … and runs twice to the same bytes" | Pass |
| TC-06 | The live feed uses the frozen and tuned values | Compare `POOL_PARAMS`, `PRIOR_M` and `SOCIAL_PARAMS` of the backend with `frozen-v1.json` and with the approved run config `p7-main.json` | Equal | `apps/backend/src/feed/feed.constants.spec.ts`, "TC1: alpha and beta equal the approved H params of syn-W2M-M in p7-main.json" | Pass |
| TC-07 | The live feed gives the order of the evaluation (parity) | For each of 100 pairs and each of the 3 `algo` values: compare the whole order of `FeedService.rank` (size and SHA-256) and the first two pages of `GET /api/posts?algo=…&asOf=…` with the harness | Equal; first 20 posts equal | `apps/backend/test/parity/parity.parity-spec.ts`, one test for each pair | 102 of 102 pass |
| TC-08 | The test-only `asOf` cannot reach production | Start the app with `FEED_ASOF_ENABLED=true` and `NODE_ENV=production`; call the feed with `asOf` while the flag is off | The app does not start; the call gives 400 | `apps/backend/test/it/feed-options.it-spec.ts`, "F12: the backend does not start with the flag on and NODE_ENV=production" and "with the flag off, asOf is 400" | Pass |
| TC-09 | Paging stays at one time *t* | Walk all pages of 27 posts at a fixed `asOf`, for each `algo`; ask page 2 two seconds after page 1 without `asOf` | No repeat and no gap; the order equals `FeedService.rank` | `apps/backend/test/it/feed-algo.it-spec.ts`, "DW7: paging" (2 tests) | Pass |
| TC-10 | The feed leaves out what it must, and blocked users | Build a fixture with blocked, own, deleted, pending, repost-row, reply, old and future posts; read the feed for each `algo` | Only the three allowed posts, in the order of `FeedService.rank` | `apps/backend/test/it/feed-algo.it-spec.ts`, "DW5: the fixture rules" | Pass |
| TC-11 | A socket is the user of the cookie, not the name it claims | Alice sends `newUser` with Bob's name; Carol sends Bob a direct message | Alice gets no message; Bob gets it | `apps/backend/test/it/socket.it-spec.ts`, "S1: alice claims to be bob with newUser and still does NOT get bob's DM" | Pass |
| TC-12 | A ban logs the user out at once | A user is connected; an admin bans the user; the banned user writes with a valid cookie | The socket gets `accountBanned`; the write gives 403 | `socket.it-spec.ts`, "accountBanned still reaches the banned user"; `visibility.it-spec.ts`, "the guard reads the database, so a ban takes effect at once for a valid cookie"; the browser part is Figure 8.8 | Pass |

## 8.3 The bugs the tests found

The tests and the checks found 48 problems in the app. First a code review listed 26 suspected problems. Then we ran the app (curl scripts, Socket.IO scripts and Chrome). The run confirmed 25, half confirmed 1, and found 10 new ones: 36 findings. The fixes found 7 more small items (R1 to R7), and the demo sweep found 5 (V1 to V5). Of the 48 problems, 40 are fixed and 8 are open. The numbers come from the Bugs Report of the project (`.docs/Bugs Report.md`, section 1).

Each fix started with a test that failed. The same curl script gave 42 passed and 53 failed on the code before the fixes, and 95 passed and 0 failed after them. The bugs of the thesis path are covered by test cases of this chapter: the clock in Explore (T4) by the `asOf` tests, the stale feed cache (T3) and the duplicate follow (T6, in the feed) by `feed-algo.it-spec.ts`, and the socket rooms (S1) by TC-11.

The 8 open items are future work (Chapter 9): the missing unique keys of likes, saves and follows (T6) with the three items that need the same migration (N3, N10 and the schema part of R4), and four small items (R5, N7, N9 and B8). The six items that were needed before the app is put on a shared server (B1, S4, S6, B5, R3 and R6) are fixed, for example the fallback token secret (S6) and the missing check of moderation actions (B1). For R3, the packages, only the updates that need no major version were made. The others need NestJS 12 and Fastify 5, and they are future work (Chapter 9). T6 is the only open item on the thesis path. It can make duplicate rows, but the social feed counts each followee once, and a test checks this ("T6: a follow stored twice counts once (social)").

## 8.4 Demonstration

The demo runs on generated data, not on the development data. The command `npm run demo:start` loads the dataset `syn-W2M-M` (1,000 users) into its own Postgres schema `eval_demo`. The loader moves all times by one constant (`--rebase-to`), so that the newest event has the time of the start. Without this, Explore, which looks at the last 7 days, would be empty. The demo uses Redis database 3, so the development data (schema `public`) and the parity data (schema `eval_load`, Redis database 2) are not touched. The command also adds one admin account (`demo_admin`), starts the backend and the frontend, and prints the logins. It took 17 seconds in the rehearsal.

Two users play the demo. The long-history user `u0000000064` has 28 positive actions before the start time and follows 426 users. The little-history user `u0000000787` has 2 positive actions and follows 273 users. The password of both is `password`. The checklist `scripts/demo/CHECKLIST.md` has the steps with their expected results, for two browser windows: a normal one and a private one, each with its own cookies. The rehearsal of 2026-11-22 played every step, and all nine passed (Table 8.1). The screenshots below come from the same demo. Only one browser session was available, so a script (`peer.mjs`) played the second user; in the real demo, the second user has a second window.

Figures 8.1 to 8.3 show the For You page of the long-history user, with the three values of `algo` (requirement FR21). Figure 8.1 is Chronological, the baseline BL0. The first posts are the newest ones, Post 19994, 19992 and 19991.

[Figure 8.1: `fig8-1-foryou-chrono`. Caption: For You with Chronological (`algo=chrono`, BL0).]

Figure 8.2 is Engagement, the method BL2. The posts are ranked by the engagement score (likes, comments, reposts and age), so the first posts, Post 19981, 19957 and 19821, are not the newest.

[Figure 8.2: `fig8-2-foryou-engagement`. Caption: For You with Engagement (`algo=engagement`, BL2).]

Figure 8.3 is Social, the hybrid score H of this thesis (contribution C2). Many posts are marked with a community (c/c5, c/c6) and are one or two days old: the score brings forward older posts from followees and joined communities. None of its first 10 posts is in the first 10 of Chronological (the output of `npm run demo:users`).

[Figure 8.3: `fig8-3-foryou-social`. Caption: For You with Social (`algo=social`, the hybrid H).]

The three orders differ for the same user. This shows that the option works. It does not show that Social is better: Chapter 6 measures that, and Chapter 7 discusses the result.

Figure 8.4 shows Explore (requirement FR22). Explore ranks the newest posts of the last 7 days with the same engagement score as BL2. So its first posts are the same as those of Figure 8.2, and the first four are only 1 to 11 hours old, because the data was rebased to the start time.

[Figure 8.4: `fig8-4-explore`. Caption: The Explore feed.]

Figures 8.5 to 8.8 show the real-time parts (NFR4). In Figure 8.5, the little-history user writes to the long-history user. The long-history user has the conversation open. The second message, "This one arrives live, without a reload.", came over Socket.IO while the page was open, and the badge of Messages shows 1 (requirement FR15).

[Figure 8.5: `fig8-5-direct-message`. Caption: A direct message that arrives live in an open conversation.]

Figure 8.6 shows a like. The little-history user likes a post of the long-history user, and the notification "User 787 liked your post" is pushed to the open page (requirement FR16). It is saved first, so a user who is offline sees it later.

[Figure 8.6: `fig8-6-notification`. Caption: A live notification.]

Figure 8.7 shows the admin console (requirement FR18). The admin searches for the little-history user and bans the account. The row shows BANNED, and the button changes to Unban.

[Figure 8.7: `fig8-7-admin-ban`. Caption: The admin console after a ban.]

Figure 8.8 shows the other side of the ban (requirements FR18 and NFR4). The page of the banned user was open. It went to `/sign-in?banned=true` at once, with the text "Your account has been suspended. Please contact support." This is the event `accountBanned` of Section 5.4, handled by the browser. The command `npm run demo:stop` lifts the ban at the end.

[Figure 8.8: `fig8-8-banned-signin`. Caption: The banned user is signed out at once.]

## Notes for the author (remove before the final version)

1. **Where each count comes from.**
   - Ranking 85 (7 suites: 9, 13, 3, 14, 5, 4 and 37 tests), backend unit 211 (18 suites), demo helpers 22, evaluation 434 (43 files): I ran the suites on 2026-11-22 and counted the tests of each file.
   - Integration 171: I did not run them (no Docker). I counted the test files: 137 `it(` lines, plus the `it.each` cases (input-errors 53 tests, quick-wins 22, feed-algo 11 in all), which gives 171. The same number is in `verify.sh` of 2026-11-22 (`.docs/works/2026-11-22-p10-demo-script/plan.md`) and in `.docs/Bugs Report.md`.
   - Parity 102: from the same record ("102 of 102 pass"); the test file has 2 checks of the sample plus one test for each of the 100 pairs.
   - 95 checks: `sweep-after.txt` and the record of `p9-bug-quick-wins` (95 passed, 0 failed, 2026-11-20); 11 of them are the socket checks (`record(` calls in `scripts/verify-socket.cjs`). 42 passed and 53 failed is `sweep-before.txt`.
   - Sweep: 28 pages (24 PASS, 2 FAIL known T6, 2 FAIL new V1) and 15 flows (all PASS, some with a new V finding), counted in `sweep.md`. V1 was checked again in Chrome after the fix (`p10-demo-fixes` plan, A1).
   - Rehearsal 9 steps (0, 1, 2, 3, 4, 5, 6a, 6b, 7), all PASS, in `rehearsal.md`.
   - 1,025 = 85 + 211 + 171 + 102 + 434 + 22.
2. **Bug numbers.** 48 = 36 (review) + 7 (R1 to R7) + 5 (V1 to V5). 40 fixed, 8 open (the Bugs Report counts the same). The 8 open are future work (T6, N3, N10, R4, R5, N7, N9, B8). The 6 that were "before sharing the app" (B1, S4, S6, B5, R3, R6) were fixed by `p10-security-fixes` on 2026-11-25; for R3 only the part that needs no major version.
3. **The test-case IDs.** TC-01 to TC-12 are IDs of this chapter only. Some test files have their own labels (for example "TC15" in the parity file); the table names the real test, so there is no mix-up.
4. **The screenshots.** Taken by Claude (Opus) from the live demo. The second user was played by `peer.mjs`, because the browser tool has one session. The text says so in one sentence.
5. **Figures 8.2 and 8.4 show the same first posts.** The text says so on purpose: Engagement ranks the For You pool with the Explore score.
6. **No experiment result is typed.** The text says that the demo "does not show that Social is better" and points to Chapters 6 and 7. The facts of the demo (28 positive actions, 426 follows, 17 seconds, the first posts of each feed, none of the first 10 Social posts in the first 10 Chronological posts) are demo facts, not experiment results.
7. **Reference to other chapters.** Section 6.12 is the E7 section (checked in the build of 2026-11-22). Section 5.4 is the real-time layer. Chapter 9 should list the 8 future-work items of section 8.3.
8. **Layout.** The chapter is 9 pages (pages 61 to 69 in the build of 2026-11-22), with the eight screenshots. The two tables are `longtable`s in `\footnotesize`; `test-cases-and-demonstration.tex` sets the float parameters for itself and puts them back at its end. In the PDF, the table and figure numbers run through the whole thesis (Tables 29 and 30, Figures 15 to 22); this draft uses the working names 8.1, 8.2 and so on.
9. **No new reference.** The chapter cites no source, so `references.tex` is not touched. It reads `\ref` labels of Chapters 4, 5 and 6 (`tab:design-fr`, `tab:design-nfr`, `tab:method-methods`, `sec:impl-realtime`, `sec:impl-tests`, `sec:results-e7`). Chapter 9 has no label yet, so the text says "Chapter 9" in plain words.
