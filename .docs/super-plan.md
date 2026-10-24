# Breadit Thesis Super Plan

Version 0.7 · 2026-10-24 · Direction: Hướng A, Social-Graph-Aware Hybrid "For You" feed

This is the blueprint for the whole thesis phase: code, datasets, benchmarks, statistics and writing. It is organized by phase, in the order the work depends on. The thesis must be finished before **2026-11-20**. If time runs short, §8 says what to drop first. The main rule is simple: **every number in the thesis must come from a command that gives the same result every time.**

Four decisions are already made:
- **Data:** a seeded synthetic generator is the main source. One public dataset, chosen in P1 against fixed criteria (Digg 2009 is the first candidate), is a stretch goal. No real-user pilot.
- **Method:** the heuristic hybrid score (Option A) plus ablations. No DiffNet, no learned baseline.
- **Determinism:** two classes. Quality results are byte-identical. Latency is repeatable, not identical (section 2).
- **Workflow:** each phase is done as one or more task folders in `.docs/works/`: spec, design and plan, each approved by the author, then code (`.claude/README.md`).

---

## 1. Goal, questions and hypotheses

**Goal.** Make the "For You" feed personal by using the follow graph and community membership. Show by measurement that it helps, mostly for new users.

**RQ1.** Does adding social-graph signals (follow trust and community affinity) to the ranking improve the "For You" feed over the current heuristic, especially for users with little history?

**RQ2.** How does the level of social interaction between users change the ranking quality? What is the minimum level where the social signal starts to help?

Hypotheses are frozen before the first test-split run (section 7). If one changes later, add a dated line to the change log at the end.

- **H1 (RQ1).** For users with 0–4 earlier interactions, the hybrid has higher NDCG@10 than BL2. It passes if the paired 95% confidence interval of the difference is above 0 after Holm correction. Primary test: the middle cell of synthetic world W2 (section 7), size M. The other two cells are reported as a sweep.
- **H2 (RQ2).** The gain over BL2 grows with social density (number of followees, amount of friend engagement in the pool). It is about zero when the user follows nobody and has no community.
- **H0 (sanity).** In the null world W0 (no social influence) the hybrid must not beat BL2. If it does, there is a bug or a leak. Stop and fix before any other result is used.

If H1 or H2 fails, the thesis reports it as it is. A negative result with a clean protocol is still a valid result.

---

## 2. Determinism contract

**Class D: byte-identical.** Datasets, features, rankings, metrics, statistics and the data behind every table and figure. Each output file has a SHA-256 hash in one `manifest.json`. A re-run must give the same hashes.

**Class R: repeatable.** Latency, throughput and similar timing numbers. They depend on the clock and the machine, so they cannot be identical. We fix the data, the load and the environment, run N times, and report the median with a 95% confidence interval. The thesis says "repeatable", never "identical", for these numbers.

Rules for Class D:
- **No wall clock.** Every scorer takes `asOf` as an argument. `Date.now()` and `Math.random()` are not allowed in `packages/ranking/` or `eval/` (a grep test checks this, and the harness hook reports it after each edit).
- **One seeded PRNG.** `rng(masterSeed, stageName)` returns an sfc32 generator seeded from `sha256("<masterSeed>:<stageName>")`. Each stage has its own stream, so adding a stage never changes the others. We do not reuse `mulberry32` from `seed.ts`: it has only 32 bits of state, and its author recommends other generators [26].
- **Integer scores.** Scores are fixed-point integers, like the current `Math.floor(score * 100)` in `computeExploreScoreFixed` (`posts.service.ts`). Sums run in a fixed order (sorted by id).
- **Total tie-break.** Sort by `(scoreFixed desc, postId desc)`. No ranking depends on database row order.

More rules for Class D:
- **Explicit data.** Generated data has explicit IDs (including user IDs, not `cuid()`) and integer timestamps counted from a fixed base epoch.
- **Canonical files.** CSV, UTF-8, LF line endings, sorted rows, fixed column order, metrics printed with 6 decimals.
- **Pinned environment.** Docker images by digest, `npm ci`, `.nvmrc` and `engines`. The Node version goes into the manifest, because `Math.log2` and `Math.pow` can differ between engines.
- **No cache, no HTTP.** The evaluation reads data directly. It never goes through Redis, the throttler or the API.

These rules follow common advice for reproducible computing: record seeds and exact versions, and script every step [27].

---

## 3. Where we start

These facts were checked in the code on 2026-10-22, after the bug sweep (Bugs Report §5: 14 findings fixed). Line numbers moved during the sweep, so this plan names functions instead.

**Feed code**
- The "For You" feed (no `feed` param, logged in) shows posts from you and your followees, newest first, with no community posts (`findAll` in `posts.service.ts`). It is not the same for everyone, and a new user with no follows sees only their own posts. `Thesis_Orientation.md` describes it as the same for everyone; that is not exact.
- Explore uses `Date.now()` for its 7-day window and for post age (Bugs Report T4). The same query gives different results tomorrow, so it cannot be replayed at a past time.
- Community posts are excluded from both home and Explore (`communityId: null`). Community affinity cannot work until they enter the candidate pool.

**Data**
- Every event table has a `createdAt` column (`Like`, `Follow`, `CommunityMember`, `Comment`, `Post`, `SavedPosts`), so features can be computed as of a past time. But unlike, unfollow and leaving a community are hard deletes, so the live database loses history. Only generated data has the full history.
- `Like`, `Follow` and `SavedPosts` have no unique constraint, and the clean seed already has duplicates (T6). Generated data has none.
- `seed.ts` is not deterministic (the admin id is a `cuid()`, bcrypt salts are random, a batch shares one timestamp, no `orderBy` before the PRNG picks). `humans_v1` has 0 follows and 0 likes. Neither can be used for evaluation.
- `User.followers` in the Prisma schema counts the accounts a user **follows**, not their followers. Always query the `Follow` table directly.
- `Thesis_Orientation.md` (step 1 of Hướng A) says: with no real users, simulate the interactions with a Pareto distribution (20% of users make 80% of the actions). The generator in P3 does exactly that, so the data choice follows the Orientation.

**Tooling**
- The root `workspaces` list is `apps/*` and `packages/*`. A new top-level `eval/` folder is not a workspace until it is added there. The backend does not depend on any workspace package yet.
- Node is v22.14.0 on the author's Mac and `node:20-alpine` in Docker. There is no `.nvmrc`.
- `docs/planning/k6_results.json` did not come from the current k6 script. Its 71% failed requests match the old limit of 120 requests per minute, which was raised to 1000 in commit `6f7b884` (`app.module.ts:28`). The limit is counted per route per IP (N6). The file does not store status codes, so this is the likely cause, not a proven one. Pre-thesis chapter 5 reports under 1% errors, which contradicts that file.

---

## 4. Phase plan

The phases are in dependency order. Each phase becomes one or more tasks (column "Tasks", started with `/task` or `/bugfix`). A phase is done when its "Done when" passes. ★ marks a supervisor checkpoint: send the result and wait for the answer before the next phase depends on it.

| Phase | Output | Done when | Tasks |
|---|---|---|---|
| P0 Baseline freeze | Node pinned, image digests | A clean clone passes install, migrate, seed, typecheck | `p0-baseline-freeze` |
| P1 Literature, RQ and data lock ★ | `literature.md`, `datasets.md`, one-page note, Chapter 2 survey | The supervisor confirms the RQs, the data and the design decisions | `p1-literature`, `p1-dataset-selection`, `p1-supervisor-note`, `p1-related-work` |
| P2 Implementation blueprint | `implementation-plan.md` | The author approves it, and it names every later task | `p2-implementation-blueprint` |
| P3 Synthetic generator | `eval/` workspace, worlds W0–W2, loader | Two runs give the same hashes | `p3-synthetic-generator`, `p3-postgres-loader` |
| P4 Public dataset adapter (stretch) | The P1 dataset in the canonical format | The adapter output hash is stable | `p4-dataset-adapter` |
| P5 Ranking package and harness ★ | `packages/ranking`, harness, baseline table | Golden, leakage and double-run tests pass | `p5-ranking-package`, `p5-eval-harness` |
| P6 Social feed in the app | `algo` param, `asOf` flag, feed toggle | Live order equals harness order | `p6-social-feed` |
| P7 Experiments ★ | E1–E7 tables and figure data | Hash check against the manifest | `p7-offline-experiments`, `p7-cost-benchmark` |
| P8 Repro package and freeze | `npm run thesis:repro`, tag | One command rebuilds everything | `p8-repro` |
| P9 Writing ★ | Thesis chapters | Every number comes from a CSV | One writing task per chapter group |
| P10 Defense package | Slides, demo script, final checks | Slides and demo are ready, checks are clean | `p10-defense-package` |

The Tasks column for P3–P10 is a first guess. The P2 blueprint sets the final task list.

### P0: Baseline freeze

**Already done.** The tag `v1-prethesis` on `6f7b884`. `CLAUDE.md` and `.docs/` are committed on `test-app`, the single working branch.

**Do.** Pin Node 20, the same as the Docker image, with `.nvmrc` and `engines`. A clean clone runs the Docker image, and the manifest records the Node version, so local runs must use the same major version. Run the backend tests and the harness tests on Node 20. Pin `postgres:16-alpine`, `redis:7-alpine` and `node:20-alpine` (both Dockerfiles) by digest. The four pre-thesis text corrections stay listed in Bugs Report §7 and are fixed in the new thesis text (open item 5). Fast-forwarding `main` to `test-app` needs the author's approval.

**Done when.** A clean clone passes `npm ci`, `prisma migrate deploy`, the seed and `npm run typecheck` on Node 20.

### P1: Literature, RQ and data lock ★

P1 does more than collect citations: every paper either decides something in our design or is cited in Chapter 2. It has five steps.

**Step 1: map the field** (task `p1-literature`). Skim every reference in §10: the abstract, the method, and how it was evaluated. Search for recent work (2022 or later) on social recommendation, cold start and feed ranking (done on 2026-10-24: §10 now has 12 recent references, [31] to [42]; the closest work and the search log are in `.docs/literature.md` §7). Write a few lines per paper in `.docs/literature.md`: what it says, what it means for us, and where Chapter 2 cites it. Correct the DiffNet title: the paper is "A Neural Influence Diffusion Model for Social Recommendation" [3]; DiffNet is the model name.

**Step 2: dataset selection** (task `p1-dataset-selection`). Choose the public dataset before P3 and P4 depend on it. Score each candidate against four criteria, which come from what the method needs (sections 5 and 6):
- **Social graph:** directed follows between users, ideally with timestamps. Without them, future follows leak into the past.
- **Interactions:** positive actions (like, vote, favorite) with timestamps, on items authored by users in the same graph. The author term needs `author(p)`.
- **Communities:** group membership, for the community term.
- **Practical:** terms of use that allow thesis use, the data still downloadable, and a size that runs on a laptop.

Candidates to check: Digg 2009 [20], Epinions and Ciao [19], the Flickr favorites data, and a Weibo retweet dataset. None of their details are verified yet; add each one used to §10 once verified. The output is `.docs/datasets.md`: the candidate table, the decision, what each dataset can and cannot test, and calibration targets for the generator (activity skew, follower and followee distributions, interactions per user), each with its source. If no candidate meets the first two criteria, P4 is dropped and the thesis uses synthetic data only (§8).

**Step 3: answer the design questions** (task `p1-literature`). Each question gets a decision in `.docs/literature.md`: the question, the options, the evidence, and our choice. They include the three choices in §6, so P5 starts from decisions, not open questions.

| Design question | Papers | What it decides |
|---|---|---|
| How much should a follow count (trust), and should it fade over time? | RealGraph [5], Twitter [6][7], SoRec [2], SocialMF [8] | The trust formula (§6) |
| How do we help users with no history yet? | Sedhain [9], Tang [1] | The prior `m` and its form (§6) |
| Is community membership a useful signal, and in what form? | Orkut communities [10] | The community term (§6) |
| Should influence reach friends of friends (2 hops)? | DiffNet [3], SocialMF [8], Sharma [4] | 1 hop or 2, and the Chapter 2 argument for the choice |
| Are the baselines strong enough? | Ferrari Dacrema [25], Reddit [11], Hacker News [12] | BL4, BL5 and BL6 (§5) |
| How do we split and measure without bias? | Meng [13], Ji [14], Krichene [15], Cañamares [16], Ge [17], McSherry [18] | The protocol (§5) |
| How do we show the result is not built into the data? | Anagnostopoulos [23], Chaney [24] | Worlds W0 and W1, the shuffle test (P3, E5) |

**Step 4: lock the decisions ★** (task `p1-supervisor-note`). Write the one-page note from the Orientation's week-0 checklist: direction A and why, the new contribution C2, the metrics. Add the data choice from `.docs/datasets.md` (synthetic worlds, as the Orientation allows when there are no real users, plus the chosen public dataset if P4 works), the design decisions from Step 3, and the scope cuts in §9. The supervisor confirms them all at once.

**Step 5: write the survey** (task `p1-related-work`). The Orientation asks for a 3–4 page survey. It becomes the core of Chapter 2.

**Status (2026-10-24).** The task `p1-literature` is done: Steps 1 and 3, in `.docs/literature.md` (44 references, decisions D1 to D7, 10 claims, and proposed changes PC1 to PC10). Steps 2, 4 and 5 are not started. The author decided the proposed changes PC2 to PC10 on 2026-10-24 (version 0.7). The open points are in §11, item 6.

**Who reads what.** The author deep-reads the core papers, because the committee will ask the author about them: Tang [1], SoRec [2], RealGraph [5], Sedhain [9], and Krichene and Rendle [15]. Claude prepares the notes on the others, searches for recent work, and checks every reference. RealGraph [5] and the Twitter blog [7] are now verified in full text (task `p1-literature`, notes in `.docs/literature.md`). The blog [7] was read through an Internet Archive copy. The full texts of [1], [2], [8], [9], [16], [21], [23] and [28] are still missing. Until they are read, cite [21] (the test comparison) and [23] (the timestamp shuffle) by name only, and do not describe what they found.

**Done when.** The supervisor confirms RQ1, RQ2, the data choice and the design decisions. Every design question has an answer with evidence. Every reference cited in Chapter 2 is marked "verified" in §10.

### P2: Implementation blueprint

The super plan says what we build and in what order. The blueprint says how the pieces fit together in the code. It comes after P1 because it needs the P1 decisions (the dataset, the trust formula, `m`). It is one file, `.docs/implementation-plan.md`, written as the task `p2-implementation-blueprint` and approved by the author like any task. Every later task's spec links to the part of the blueprint it implements.

**Do.** The blueprint has four parts:
- **Module map.** The folders and packages: `eval/` (generator, adapter, loader, harness, report), `packages/ranking` (scorers, `buildPool`, baselines), the backend module and the frontend toggle. It says which may import which: `eval` and the backend import `packages/ranking`, and nothing imports `eval`.
- **Data contracts.** Everything two or more tasks share: the canonical CSV files (users, follows, communities, memberships, posts, interactions) with their columns, types, ID rules and sort order; the `manifest.json` format; the signatures of `buildPool`, the as-of feature functions and the scorers; the results CSVs; the macro names.
- **Measurement plan.** For each experiment E1–E7: the input data, the methods, the metrics, the output file, and the thesis table or figure it feeds. One table links RQ → hypothesis → experiment → table → chapter.
- **Task list.** Every task folder for P3–P10, with its scope, its order and what it depends on. Each later `/task` starts from its row.

**Rule.** If two tasks touch something, it goes in the blueprint. If only one task touches it, it stays in that task's `design.md`. This keeps the blueprint short.

**Done when.** The author approves the blueprint. Every hand-off has a contract: generator → loader, generator and adapter → harness, `packages/ranking` → backend, harness → report → macros. Every later task has a row in the task list.

### P3: Synthetic generator

**Do.** Decide D1 first (Bugs Report §4), because it decides who can post into a community. Create the `eval/` workspace (`@breadit/eval`) and add `eval` to the root `workspaces`. Write a versioned config `eval/config/synthetic-v1.json`. Calibrate its parameters to the targets in `.docs/datasets.md` where they exist, and say in the config which values are calibrated and which are chosen. The generator has five stages, each with its own PRNG stream: users (with hidden interests and Pareto activity, about 20% of users make 80% of actions), follow graph, communities and memberships, posts, interactions. It writes canonical CSV and a `manifest.json`. The generator does not run the feed, so interactions never depend on a ranking and there is no feedback loop in the data [24].

Three worlds, so a reader can see the result is not built into the data:
- **W0, null.** Interactions depend on interests only. Follows and memberships carry no influence.
- **W1, latent homophily.** Follows and interactions both come from shared interests. Still no influence.
- **W2, influence sweep.** Three cells: low, middle and high social influence, at the middle homophily strength (section 7).

Two sizes: S and M (section 7).

A loader writes the same data into Postgres with explicit IDs, so the live app can run on it (P6 parity test, P10 demo). The loader has a demo-only `--rebase-to` option that shifts timestamps to today. Experiments never use it.

**Done when.** Generating twice gives identical manifests. Loading twice gives identical canonical table hashes.

### P4: Public dataset adapter (stretch)

**Do.** Convert the dataset chosen in P1. The text below assumes Digg 2009 [20], the first candidate: it has timestamped votes and a directed follower graph, so it looks like a feed. Raw files are downloaded by hand, stay out of git, and are recorded with source URL and SHA-256. Check the terms of use before download; the page states no license. The adapter converts the data to the same CSV format as P3. Digg has no community membership, so the community term is switched off there (or item categories are used as a stand-in and marked as a limitation). The Digg follower graph may have no timestamps (not confirmed). If so, it is treated as fixed over time, which can leak future follows into the past. Report this as a limitation.

**Gate.** If the dataset is not converted by the time the P5 baseline table is done, drop this phase and state "no public dataset" as a limitation (§8).

**Done when.** The adapter output hash is stable and a table of users, items and edges is printed.

### P5: Ranking package and evaluation harness ★

**Do, part 1: `packages/ranking` (`@breadit/ranking`).** Pure code: no Nest, Prisma or Redis imports. Move `computeExploreScoreFixed` from `posts.service.ts` into it and make the backend import it, so BL2 in the evaluation is the production code. Add the baselines BL0–BL6, with a grid for BL2t, BL4 and BL5 (section 5), the hybrid (section 6) and the shared `buildPool` (section 5). The author cap `applyExploreDiversity` is a page-level filter and stays in Explore. Point the harness determinism check and rule (`.claude/hooks/lib.cjs`, `.claude/rules/determinism.md`, the `leakage-auditor` and `designer` agents) at `packages/ranking/` instead of `apps/backend/src/ranking/`.

**Do, part 2: the harness.** Build the protocol in section 5 in `eval/src/` (`harness`, `metrics`, `stats`, `report`). Baselines are pure functions that take the same pool. Statistics are written in TypeScript, then cross-checked once against scipy on a small fixture. The fixture result is committed.

**First output ★.** A baseline table (BL0–BL5, validation split, W0, W1 and W2 at size S) goes to the supervisor before tuning starts.

**Done when.** Three tests pass. (1) Golden: a tiny committed dataset gives a committed CSV. (2) Leakage: change or delete every event after `t_u` for a user, and that user's ranking must not change. (3) Double run: two full runs give equal hashes.

### P6: Social feed in the app

**Do.** Add a thin Nest service and module that load data (reusing `getFolloweesIds`, `getCommunityIds` and `BlockService.getAllBlockedPeerIds`) and call `packages/ranking`. The live pool uses the shared `buildPool`: it lets approved community posts in (`isApproved = true`, Bugs Report R2) and counts distinct followees (T6 is still open). A community ban must clear the cached community list (B6), because the scorer reuses `getCommunityIds`.

Add a feed option `algo` with values `chrono`, `engagement` and `social`. It goes through `posts.controller.ts` into `findAll` and into the cache key. The default behavior of "For You" stays unchanged until the experiments are done. The frontend changes are in `app/(board)/page.tsx` (whitelist), `Feed.tsx` and `InfiniteFeed.tsx` (query key). A test-only `asOf` query parameter is enabled by an env flag and never in production (T4).

The `reasons` list per post is cut in v0.2. The score's three terms are still interpretable, but the thesis does not claim explanations shown to users.

**Done when.** A parity test passes. For 100 sampled (user, `asOf`) pairs on the P3 dataset loaded into Postgres, the live endpoint returns the same order as the harness. The test runs with `REDIS_HTTP_CACHE_ENABLED=false`.

### P7: Experiments ★

Run each experiment once on the frozen config. Do not look at test results while tuning.

| ID | Question | Output |
|---|---|---|
| E1 | How do all methods compare? | Methods × datasets × K × metrics |
| E2 | Does the hybrid help cold-start users? (RQ1) | Results by history bucket |
| E3 | Where does the social signal start to help? (RQ2) | Gain against social density and against own history |
| E4 | Which term matters? | Ablations: follow-only, community-only, author term, engager term, `m` |
| E5 | Is the result built into the data? | W0 null world, the three W2 cells, timestamp shuffle (our own test; see [23] on influence and correlation) |
| E6 | Do ties change the result? | Rerun with reversed tie-break |
| E7 | What does the new feed cost? (Class R) | Latency and query count for `chrono`, `engagement`, `social` |
| E8 | Does the pool size change the result? | Main comparison again with the larger pool (W_L, N_L): H, BL2 and the baseline with the highest validation NDCG@10; world M, K = 10 |

E7 uses k6 with a fixed seed and a fixed load profile, on size M. Run 5 times, drop the first run as warm-up, and report the median with a bootstrap confidence interval. The throttle limit in `app.module.ts:28` must become an env variable so the benchmark can raise it (N6). A run counts only if `http_req_failed` is 0. This gate would have caught the 71% failures in the pre-thesis data. Also count the Prisma queries per request. That number is deterministic.

### P8: Repro package and freeze

**Do.** Add `npm run thesis:repro`. It needs `npm ci` and Docker db and redis. It generates the datasets, runs the adapter (if P4 is in), runs all experiments, writes the tables and macros, and compares every hash with `.docs/results/manifest.json`. It fails on any difference. Tag the result `v2-thesis-experiments` (the author approves the tag).

**Done when.** The command passes on a clean clone.

### P9: Writing ★

**Do.** Chapter 2 starts in P1. The rest follows the chapter map below. A report script turns the CSVs into LaTeX tables and a `results-macros.tex` file with named numbers (for example `\recallGain`). The text uses the macros and never typed numbers. This removes the pre-thesis problem where the abstract and chapter 5 disagreed. When writing starts, copy the `Latex/` template into `.docs/latex/`. Do not edit `Latex/`. The supervisor reads the full draft (★).

**Chapter map.** The order follows the pre-thesis report (`Latex/main_docx.tex`). Check it against the university rules (open item 2).

| # | Chapter | Reused from the pre-thesis | New in the thesis | From |
|---|---|---|---|---|
| 1 | Introduction | Background, problem statement | RQ1, RQ2, contributions C1–C3 | §1, Orientation |
| 2 | Literature Review | Platform architecture (shorter) | Social recommendation, feed ranking heuristics, offline evaluation | P1, §10 |
| 3 | Methodology | Development process (shorter) | The hybrid score, the cold-start curve, the evaluation design (data, protocol, metrics, statistics) | §5, §6, P3 |
| 4 | Implementation | Backend, frontend, real-time layer (C1, C3) | `packages/ranking`, the `algo` option, `eval/`, the repro command | P5, P6, P8 |
| 5 | Experiments and Results | — | E1–E7 tables and figures, macros only | P7 |
| 6 | Discussion | — | What the results mean, limitations | P7, §8 |
| 7 | Test Cases; Demonstration | Both chapters | The social feed in the demo | P6, P10 |
| 8 | Conclusion and Future Works | Structure | The corrected LightFM sentence, future work from §9 | Bugs Report §7 |

**Done when.** Every number in the thesis comes from a CSV.

### P10: Defense package

**Do.** Slides built from the same figures and macros. A demo script on generated data loaded with `--rebase-to`, showing the three `algo` options side by side. Final checks over the thesis and the slides: every number has a macro, every citation is marked "verified" in §10, and the abstract matches chapter 5. Add the `numbers-auditor` and `citation-checker` agents to the harness for these checks.

**Done when.** The slides and the demo are ready, and the final checks are clean.

---

## 5. Evaluation protocol

This protocol is frozen with the config.

**Split.** As-of temporal leave-last-out with full ranking. There are no sampled negatives, because sampled metrics can change which method looks best [15][16]. A user's *test item* is their last positive interaction (like, comment or repost) on a post they had not touched before. A user's *validation item* is their last such positive before the cut time T. One global cut time T separates tuning from testing, as in the global temporal split of [13]: every validation item is before T, and a test item must be after T. A user with no such positive after T has no test item and is left out. The rule that sets T is decided in P2, and its value is frozen in P5 (section 7).

**As-of features.** Every feature for user `u` uses only events strictly before the test time `t_u` (ties broken by event id). This includes engagement counts, post age (`t_u` minus `createdAt`), follows, memberships and trust. This rule is our own design. [14] shows that training on interactions after the test time is a source of leakage.

**Candidate pool.** One shared function `buildPool` (in `packages/ranking`) is used by both the live feed and the harness. The pool holds root posts that are not deleted, are approved, were created before `t_u`, are inside the window W, and are not blocked. It keeps the newest N_max posts. It removes the user's own posts and the user's earlier positives. If the test post is not in the pool, the user is left out. The number of left-out users is reported in total and for each history bucket. Public datasets can override W. E8 runs the main comparison again with a larger pool (W_L and N_L, section 7).

**History buckets.** History is the number of positive events before `t_u`. Buckets: 0, 1–4, 5–19, 20 or more. The Orientation uses "≤5 vs >20" and phases at 0/5/20. Those overlap at 5 and drop users with 6–20 events.

**Metrics.** With one test item at rank `r`: Recall@K equals HitRate@K, so write that in the thesis. NDCG@K is `1/log2(r+1)` if `r ≤ K`, else 0. Coverage@K is the number of distinct posts in any top-K list divided by the number of distinct posts in any pool [17]. K is 5, 10 and 20.

**Methods.** All methods rank the same pool. BL0 is the production "For You": followee posts first, newest first, then the rest newest first. BL1 is plain newest first. BL2 is the production Explore score, as of `t_u`. BL3 is global popularity (likes as of `t_u`).

BL4 and BL5 are two cheap, well-known "hot" formulas, added so the baselines are not weak [25]. BL4 is Reddit "hot" [11] with likes as upvotes and no downvotes. BL5 is Hacker News ranking [12], `(P-1)^0.8 / (T+2)^1.8`, with penalties ignored. BL6 is H-follow with every trust weight set to 1: `engagement + α · ([u follows author(p)] + the number of followees who engaged with p before t)`. It shows what the trust weights add over a plain count. H is the hybrid. H-follow (β = 0) and H-comm (α = 0) are ablations.

**Tuned baselines.** BL4 and BL5 each have one tuned parameter: the time divisor of BL4 (45,000 seconds as published) and the gravity of BL5 (1.8 as published). BL2 stays as the production score. BL2t is BL2 with its age weight tuned (0.25 per hour in production). Each grid contains the published or production value. This is so that the hybrid is not the only tuned method [25].

The Orientation names three baselines. They map like this: its BL1 "Chronological (For You hiện tại)" is our BL0 (production For You) and BL1 (plain newest first); its BL2 "Engagement heuristic" is our BL2; its BL3 "Popularity global" is our BL3.

The author cap in production Explore is a page-level filter. It is not applied in the evaluation, for any method.

**Ties.** Ties are broken by `(scoreFixed desc, postId desc)`. E6 repeats the run with the reversed tie-break. Many ties (BL3 especially) can change metrics [18].

**Statistics.** For each user, take the paired difference against the reference method. Use a paired bootstrap 95% confidence interval (10,000 resamples) and a paired randomization test (10,000 permutations), both with seeded PRNG streams. Correct all p-values with Holm [22] across the family method × K × bucket. Smucker et al. compare significance tests for information retrieval evaluation [21].

**Tuning.** Tune α and β on the validation items only (all before T), using the grid in section 7. Choose by NDCG@10, and break ties by the smaller (α, β) pair. The same rule tunes the one parameter of BL2t, BL4 and BL5 on their grids (section 7), and the α of BL6 on the α grid; ties go to the smaller value. Freeze the choice. Then run the test item once.

---

## 6. The hybrid score

```
H(p, u, t) = engagement(p, t) + α · social(p, u, t) + β · community(p, u, t)

engagement(p, t) = likes + 2·comments + 3·reposts − 0.25·ageHours        (as of t; same code as BL2)

trust(u, f, t)   = (n_uf + m / |F_u|) / (N_u + m)
social(p, u, t)  = [u follows author(p)] · trust(u, author(p), t)
                 + Σ trust(u, f, t)  over followees f who engaged with p before t

community(p, u, t) = (c_u,c(p) + m · [u is member of c(p)] / |M_u|) / (N_u + m)
```

Symbols: `n_uf` is u's earlier positives on f's posts. `N_u` is u's total earlier positives. `F_u` is u's followees at time t (distinct). `c_u,c` is u's earlier positives in community c. `M_u` is u's communities at time t. `m` is the prior strength.

Three design choices, confirmed in P1 (Step 3) with the evidence in `.docs/literature.md`:
- **Smoothing with `m`.** Without it, `trust = n_uf / N_u` is 0/0 for a user with no history, and the follow signal cannot help exactly the users RQ1 is about. The form is the m-estimate [28][29]. Using it for trust and community, and the value of `m`, are my own design. At `N_u = 0` the prior spreads trust equally over followees and communities.
- **Author term.** The Orientation formula sums trust over friends who engaged with the post. A post by a followee that nobody has engaged with yet would get nothing. The author term fixes this. RealGraph gives each directed edge between users a weight that is the predicted probability of a future interaction, learned from past interaction data [5]. Twitter's engineering blog says that Real Graph is the most important component in ranking in-network tweets [7]. In the 2023 open-source release, these scores are inputs (features) for in-network tweets [6]; the code does not show how the ranker weights them. E4 shows what each term adds.
- **Phases become a curve.** With smoothing, the weight of the prior is `m / (N_u + m)`. It falls smoothly as history grows. The three cold-start phases in the Orientation doc become this one curve. Buckets are used only for reporting.

---

## 7. Frozen values

One source of truth. A change needs a new config version and a line in the change log (the author runs `/freeze`). Values marked "freeze at P3/P5" are set before the first test-split run.

| Item | Value | Freeze at |
|---|---|---|
| Master seed | 20261014 | now |
| Base epoch | 2026-01-01T00:00:00Z, timestamps in integer seconds | now |
| Score unit | integer, `floor(score × 100)` | now |
| K | 5, 10, 20 | now |
| History buckets | 0, 1–4, 5–19, ≥20 | now |
| Bootstrap resamples / permutations | 10,000 / 10,000 | now |
| Confidence level / Holm level | 95% / 0.05 | now |
| Prior strength `m` | 5 (E4 tests 0, 2, 5, 10) | P5 |
| α, β grid | 0, 1, 2, 4, 8, 16 (engagement points per unit) | P5 |
| Window W / pool cap N_max | 7 days / 2,000 | P5 |
| Cut time T | the rule is set in P2; the value is set before the first test-split run | P5 |
| Larger pool (W_L, N_L) for E8 | larger than W and N_max; values set in P5 | P5 |
| Baseline grids | one parameter each: age weight of BL2t (production 0.25 per hour), time divisor of BL4 (published 45,000 s), gravity of BL5 (published 1.8); 3 to 5 values each, including the published value; set in P5 | P5 |
| Dataset sizes | S 200 users, 4k posts · M 1,000 users, 20k posts (E7 uses M) | P3 |
| Synthetic world parameters | in `synthetic-v1.json`, calibrated to `.docs/datasets.md` where possible; W2 has three cells: low, middle and high influence at the middle homophily | P3 |
| Primary W2 cell for H1 | the middle cell | P3 |
| k6 runs / load profile | 5 runs, first dropped / set in P7 | P7 |

---

## 8. Risks and cut order

- **The result is built into the data.** If interactions are made from follows, the social signal wins by construction. Defense: the W0 null world, W1, the timestamp shuffle in E5 (our own test; [23] is cited for the question of influence and correlation), three W2 cells instead of one setting, and the public dataset if P4 works. Present synthetic results as a check that the mechanism works, and public data as outside evidence.
- **No public dataset.** If P4 is dropped, all results are synthetic. Say so plainly in chapters 3 and 6, and lean on W0 and W1 to show the result is not built in.
- **Leakage.** Defense: as-of features and the mutation test in P5.
- **Weak community evidence.** No public dataset I found has a follow graph, item interactions and explicit community membership together. State it as a limitation.

**Cut order.** The deadline is 2026-11-20. If time runs short, drop in this order:
1. P4, the public dataset (at its gate in P5).
2. The timestamp shuffle in E5.
3. E8, the larger-pool run.
4. The finer parts of E4 (author term, engager term, the `m` sweep). Keep H-follow and H-comm.
5. E7 down to `chrono` against `social`.
6. The frontend toggle in P6. Keep the backend `algo` option and the parity test.

Never cut: the W0 null world (H0), the leakage and double-run tests, the repro command, and the supervisor checkpoints.

---

## 9. Out of scope

DiffNet or other graph neural networks, a learned social baseline (SoRec, SocialMF), a real-user pilot, impression logging, online A/B tests, and Python in the main pipeline (Python is used only for the one-time scipy cross-check).

Cut in v0.2: the Epinions dataset, the schema migration (T6, N3, N10, the schema part of R4), the `reasons` field, dataset size L, and the full W2 grid. These can go into future work.

The thesis results do not need the schema migration: generated data has no duplicate rows, and the live social feed counts distinct followees (P6). If it comes back, the plan is: remove duplicates (keep the lowest `id`), add unique keys on `Like(userId, postId)`, `SavedPosts(userId, postId)` and `Follow(followerId, followingId)`, and add indexes on `Like(postId)`, `Like(userId, createdAt)`, `Follow(followerId)`, `Follow(followingId)`, `Post(createdAt, id)` and `Post(communityId, createdAt)`.

---

## 10. Appendix: references

"Verified" means I opened the source or a trusted index and the details match. "Search only" means only a search excerpt or secondary source was seen. Cite only verified items in the thesis, or check the others first. "Do not cite" means the source could not be opened or its details do not match, so a replacement is named.

1. Tang, Hu, Liu (2013). Social recommendation: a review. *Social Network Analysis and Mining* 3(4). https://doi.org/10.1007/s13278-013-0141-9 · verified
2. Ma, Yang, Lyu, King (2008). SoRec: Social recommendation using probabilistic matrix factorization. *CIKM*. https://doi.org/10.1145/1458082.1458205 · verified
3. Wu et al. (2019). A neural influence diffusion model for social recommendation (DiffNet). *SIGIR*. https://arxiv.org/abs/1904.10322 · verified
4. Sharma et al. (2024). A survey of graph neural networks for social recommender systems. *ACM Computing Surveys* 56(10). https://doi.org/10.1145/3661821 · verified
5. Kamath, Sharma, Wang, Yin (2014). RealGraph: User interaction prediction at Twitter. *UEO '14 workshop, New York*. https://www.ueo-workshop.com/wp-content/uploads/2014/04/sig-alternate.pdf · verified
6. Twitter (2023). the-algorithm (source code). https://github.com/twitter/the-algorithm · verified
7. Twitter Engineering (2023). Twitter's recommendation algorithm (blog). https://blog.twitter.com/engineering/en_us/topics/open-source/2023/twitter-recommendation-algorithm · verified (read in full through an Internet Archive copy, snapshot 20240508043115)
8. Jamali, Ester (2010). A matrix factorization technique with trust propagation (SocialMF). *RecSys*. https://doi.org/10.1145/1864708.1864736 · verified
9. Sedhain, Sanner, Braziunas, Xie, Christensen (2014). Social collaborative filtering for cold-start recommendations. *RecSys*. https://researchportalplus.anu.edu.au/en/publications/social-collaborative-filtering-for-cold-start-recommendations/ · verified
10. Chen et al. (2009). Collaborative filtering for Orkut communities. *WWW*. https://doi.org/10.1145/1526709.1526801 · verified
11. Reddit (archived). `_sorts.pyx`, the "hot" function. https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/db/_sorts.pyx · verified
12. Shirriff (2013). How Hacker News ranking really works. https://www.righto.com/2013/11/how-hacker-news-ranking-really-works.html · verified
13. Meng, McCreadie, Macdonald, Ounis (2020). Exploring data splitting strategies for the evaluation of recommendation models. *RecSys*. https://arxiv.org/abs/2007.13237 · verified
14. Ji, Sun, Zhang, Li (2023). A critical study on data leakage in recommender system offline evaluation. *ACM TOIS* 41(3). https://doi.org/10.1145/3569930 · verified
15. Krichene, Rendle (2020). On sampled metrics for item recommendation. *KDD*. https://doi.org/10.1145/3394486.3403226 · verified
16. Cañamares, Castells (2020). On target item sampling in offline recommender system evaluation. *RecSys*. https://doi.org/10.1145/3383313.3412259 · verified (record and abstract; the code repository is https://github.com/ir-uam/RecSys2020)
17. Ge, Delgado-Battenfeld, Jannach (2010). Beyond accuracy: evaluating recommender systems by coverage and serendipity. *RecSys*. https://doi.org/10.1145/1864708.1864761 · verified
18. McSherry, Najork (2008). Computing information retrieval performance measures efficiently in the presence of tied scores. *ECIR*. https://doi.org/10.1007/978-3-540-78646-7_38 · verified
19. Tang. Epinions and Ciao datasets. https://www.cse.msu.edu/~tangjili/datasetcode/truststudy.htm · verified
20. Lerman. Digg 2009 data. https://www.isi.edu/people-lerman/research/downloads/ · verified
21. Smucker, Allan, Carterette (2007). A comparison of statistical significance tests for information retrieval evaluation. *CIKM*. https://doi.org/10.1145/1321440.1321528 · verified
22. Holm (1979). A simple sequentially rejective multiple test procedure. *Scandinavian Journal of Statistics* 6(2). https://www.jstor.org/stable/4615733 · verified
23. Anagnostopoulos, Kumar, Mahdian (2008). Influence and correlation in social networks. *KDD*. https://doi.org/10.1145/1401890.1401897 · verified (Crossref record; no full text found)
24. Chaney, Stewart, Engelhardt (2018). How algorithmic confounding in recommendation systems increases homogeneity and decreases utility. *RecSys*. https://arxiv.org/abs/1710.11214 · verified
25. Ferrari Dacrema, Cremonesi, Jannach (2019). Are we really making much progress? *RecSys*. https://arxiv.org/abs/1907.06902 · verified
26. bryc. PRNGs (notes on mulberry32, sfc32). https://github.com/bryc/code/blob/master/jshash/PRNGs.md · verified
27. Sandve et al. (2013). Ten simple rules for reproducible computational research. *PLoS Computational Biology*. https://doi.org/10.1371/journal.pcbi.1003285 · verified
28. Cestnik (1990). Estimating probabilities: a crucial task in machine learning. *ECAI 1990*, pp. 147–149. https://openalex.org/W203696055 · verified (record only; no full text found)
29. Castellano, Moral-García, Mantas, Abellán (2020). On the use of m-probability-estimation and imprecise probabilities in the naïve Bayes classifier. *International Journal of Uncertainty, Fuzziness and Knowledge-Based Systems* 28(4). https://doi.org/10.1142/S0218488520500282 · verified
30. xai-org (2026). x-algorithm (source code of the For You feed on X). https://github.com/xai-org/x-algorithm · verified (README read, commit 6258a1549ef808be88fba83d3b2d58364b587ee0)
31. Jaspal, Dalwani, Ramineni (2025). SocRipple: A two-stage framework for cold-start video recommendations. *arXiv preprint*. https://arxiv.org/abs/2508.07241 · verified (abstract only; do not cite a finding from it)
32. Weyl et al. (2025). Community by design. *arXiv preprint*. https://arxiv.org/abs/2502.10834 · verified (abstract only; do not cite a finding from it)
33. Zhou, Li, Jiang, Zhang (2024). Improving social recommendation algorithm via incorporating interaction strength. *Application Research of Computers* 41(1). https://doi.org/10.19734/j.issn.1001-3695.2023.05.0280 · verified (journal page, abstract only; do not cite a finding from it)
34. Jiang, Yang, Lin (2025). Community-aware social community recommendation. *CIKM*. https://doi.org/10.1145/3746252.3761373 · verified (abstract only; do not cite a finding from it)
35. Dadgar, Hamzeh (2022). How to boost the performance of recommender systems by social trust? Studying the challenges and proposing a solution. *IEEE Access*. https://doi.org/10.1109/ACCESS.2022.3147955 · verified (abstract only; do not cite a finding from it)
36. Akpinar, Fazelpour (2025). Authenticity and exclusion: a simulation study of how social media algorithms shape visibility in epistemic communities. *Synthese*. https://doi.org/10.1007/s11229-025-05293-z · verified (abstract only; do not cite a finding from it)
37. Stefanopoulos, Chatterjee, Zehmakan (2025). A first principles approach to trust-based recommendation systems in social networks. *Online Social Networks and Media*. https://doi.org/10.1016/j.osnem.2025.100315 · verified (abstract only; do not cite a finding from it)
38. Lee, Zhou, Yang, Du, Pan (2022). Personalized recommendation system based on social relationships and historical behaviors. *arXiv preprint*. https://arxiv.org/abs/2206.13072 · verified (abstract only; do not cite a finding from it)
39. Cinus, Gionis, Bonchi (2023). Rebalancing social feed to minimize polarization and disagreement. *CIKM*. https://doi.org/10.1145/3583780.3615025 · verified (abstract only; do not cite a finding from it)
40. Chen et al. (2026). Baseline and incremental: user, item, and request debiasing in Instagram feed ranking. *arXiv preprint*. https://arxiv.org/abs/2610.27423 · verified (abstract only; do not cite a finding from it)
41. Milli, Carroll, Wang, Pandey, Zhao, Dragan (2025). Engagement, user satisfaction, and the amplification of divisive content on social media. *PNAS Nexus*. https://doi.org/10.1093/pnasnexus/pgaf062 · verified (abstract only; do not cite a finding from it)
42. Gauthier, Hodler, Widmer, Zhuravskaya (2026). The political effects of X's feed algorithm. *Nature*. https://doi.org/10.1038/s41586-026-10098-2 · verified (abstract only; do not cite a finding from it)
43. Satuluri et al. (2020). SimClusters: community-based representations for heterogeneous recommendations at Twitter. *KDD*. https://doi.org/10.1145/3394486.3403370 · verified (abstract only; do not cite a finding from it)
44. El-Kishky et al. (2022). TwHIN: embedding the Twitter heterogeneous information network for personalized recommendation. *KDD*. https://doi.org/10.1145/3534678.3539080 · verified (abstract only; do not cite a finding from it)

---

## 11. Open items

1. **What happens on 2026-11-20.** The written submission or the defense? It decides when P10 must be done.
2. **The university's thesis rules.** Format, length and required chapters. Check the chapter map in P9 against them.
3. **D1.** Can a non-member post into a community (Bugs Report §4)? Decide before P3. The recommendation is to require membership.
4. **Git actions.** The tag `v2-thesis-experiments`, fast-forwarding `main`, and each push need the author's approval.
5. **Pre-thesis corrections.** The proposal is to fix them only in the new thesis text. Editing `Latex/` and `docs/` needs the author's request.
6. **P1 decisions, 2026-10-24** (`.docs/literature.md` §9). The author decided PC2 to PC10, and version 0.7 applies them. Open points: (a) the rule that sets the cut time T belongs to the P2 design. It must check that the history bucket 0–4 keeps enough test users, and P3 must make enough users with a positive after T. (b) P5 sets the baseline grids and the larger pool (W_L, N_L), and freezes them before the first test-split run. (c) The Holm family is method × K × bucket, and BL6, BL2t, BL4 and BL5 make it larger. P2 fixes which comparisons are in the family.

---

## Change log

- 0.1 · 2026-10-14 · First version.
- 0.2 · 2026-10-22 · Organized by phase, with no week numbers. Deadline 2026-11-20. Cut: P2 (schema migration), Epinions, the `reasons` field, size L, the full W2 grid (now three cells), k6 runs from 10 to 5. Added: `packages/ranking` as the home of the shared scorer, `eval` as a workspace, the Tasks column, supervisor checkpoints (★), the chapter map (P9), P10 defense package, the cut order (§8), the Orientation baseline mapping (§5). §3 rechecked after the bug sweep; line numbers replaced by function names. H1's primary cell is now the middle of the three W2 cells (no test-split run has happened). LaTeX location decided: `.docs/latex/`.
- 0.3 · 2026-10-22 · Added dataset selection to P1 (task `p1-dataset-selection`, output `.docs/datasets.md`): four criteria, candidates, calibration targets for the generator. P4 is now the adapter for the dataset chosen there (Digg 2009 is the first candidate).
- 0.4 · 2026-10-22 · P1 rewritten as five steps (map the field, dataset selection, design questions, lock the decisions, survey), with `.docs/literature.md`; the three §6 design choices are now confirmed in P1. P2 is now the implementation blueprint (`.docs/implementation-plan.md`: module map, data contracts, measurement plan, task list). The cut schema migration moved to §9. The Tasks column for P3–P10 is a first guess until P2.
- 0.5 · 2026-10-24 · Task `p1-literature`: the marks of [5] (verified, full text; the venue "at KDD" removed because the paper does not say it), [7] (verified in full text through an Internet Archive copy), [16] (verified; the URL is now the paper DOI, not the code repository) and [23] (verified through Crossref; the URL is now the DOI); new references [28] to [44]; one sentence in the §10 intro that defines "do not cite"; line 136 and the §6 author-term bullet (RealGraph is a predicted probability of a future interaction, and the Twitter code shows scores as features) rewritten with the P1 result; the marks of [31] to [44] say "do not cite a finding from it" where only the abstract was read. The other proposed changes are in `.docs/literature.md` §9.
- 0.6 · 2026-10-24 · After the P1 literature task: the P1 text (line 110 and a status paragraph), the smoothing bullet in §6 (the form is the m-estimate [28][29]), "Who reads what" (which full texts are missing, and that [21] and [23] are cited by name only), and open item 6 (the proposed changes that wait for the author). No frozen value and no part of §5 or §7 changed.
- 0.7 · 2026-10-24 · The author decided the proposed changes PC2 to PC10 of P1 (`.docs/literature.md` §9). §5: the global cut time T, BL6, tuned BL2t, BL4 and BL5, left-out users per history bucket, the larger-pool run E8, and two wording fixes ([14] and [21]). §7: three new rows with no numbers yet (cut time T, larger pool, baseline grids), to be set in P5. §4 and §8: E8, the cut order, and [23] cited by name. No existing frozen value changed.
