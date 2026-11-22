# Plan: Demo script for the progress check

Status: done · 2026-11-22
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-22-p10-demo-script/`

No file under `apps/`, `packages/` or `eval/src/` changes (DW10). Steps 1–6 are for Sonnet; steps 7–8 are done by Opus, because the Chrome tab belongs to the main session (Design: Approach, "Rehearsal"). Docker db and redis must run. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Tests of the helpers first.** Write `scripts/demo/lib.test.mjs` with `node:test` and `node:assert/strict`: the cases TC1–TC6 below. Run it and see it fail because `lib.mjs` does not exist yet. (Design: Code files, `lib.test.mjs`.)

- [x] 2. **Helpers.** Write `scripts/demo/lib.mjs` with the six pure functions of the Design (`rebaseIso`, `feedIds`, `pagesNotAllSame`, `overlap`, `orderCandidates`, `pickUser`), no imports beyond Node built-ins, no clock read inside (the caller passes the `Date`). Run the tests until they pass. Commit steps 1–2. (Design: Code files, `lib.mjs`; users steps 2–3.) Commit: `feat(demo): demo helpers and their tests`

- [x] 3. **The demo script.** Write `scripts/demo/demo.mjs` with `start`, `users` and `stop`, in the order of the Design (Approach, "start" steps 1–10, "users" steps 1–4, "stop" steps 1–5), with the constants and helpers of Code files. Read `scripts/e7/run-e7.mjs` for the patterns it reuses (`containerName`, the `docker exec` calls, `run-safe.sh` with env). Before writing the SQL, read the column names of `User`, `Like`, `Comment`, `Post` and `Follow` in `apps/backend/prisma/schema.prisma` (Prisma keeps the camelCase names, so they need double quotes). Read the login body (`apps/backend/src/auth/dto/login.dto.ts`) and the shape of a `GET /api/posts` page (`posts.service.ts`, `{ posts, hasMore, nextCursor }`). Every failure mode F1–F18 that the script handles has its check and message as the Design says. Add `demo:start`, `demo:users` and `demo:stop` to the root `package.json`. (Design: Approach; Workflow; Failure modes; Code files `demo.mjs`, `package.json`.)

- [x] 4. **Try the script.** With nothing on :3000 and :4000: run `demo:start` and keep its output; run `demo:users` twice and compare the two outputs (the same two users); run `demo:stop` and check that :3000 and :4000 are free; run `demo:stop` once more (it must say "nothing to do" and exit 0). Then try two refusals of F2: start with a process listening on :4000 (for example the backend of `run-safe.sh` on its default schema), and see that it stops before the load. Stop that process after. Write the outputs (shortened) into a new file `tryout.md` in the task folder. Commit steps 3–4. (Design: F1, F2, F11, F13, F14.) Commit: `feat(demo): demo start, users and stop commands`

- [x] 5. **Checklist and rehearsal helper.** Write `scripts/demo/CHECKLIST.md` (Design: Approach, "Checklist": steps 0–7, the two windows, the 429 note, no `load:check`). Write `peer.mjs` in the task folder, based on `.docs/works/2026-11-20-p10-demo-sweep/second-user.mjs`: the account comes from an argument (any `eval_demo` email, or `demo_admin`), the commands are `dm`, `typing`, `like`, `ban`, `unban`. Try each command once against the demo from `demo:start`: `ban` and `unban` on a loaded user that is **not** one of the two demo users. Then run `demo:stop`. Add the outputs to `tryout.md`. (Design: Approach, "Checklist", "Rehearsal"; Code files.) Commit: `docs(demo): presenter checklist and rehearsal helper`

- [x] 6. **Docs.** `CLAUDE.md` Commands: the three demo commands, schema `eval_demo`, Redis database 3, run nothing else on :3000 and :4000. `docs/System_Architecture.md`: `eval_demo` in the schema table, the loader paragraph, and the row "Slides and demo" (demo script ✅, slides 🔜). `docs/Guidance-Manual/en/04-data.md` and `vi/04-data.md`, "Into Postgres": the demo loads into `eval_demo`, not `eval_load`; English first, then the same in Vietnamese. (Design: Code files, the docs rows.) Commit: `docs: demo commands and the eval_demo schema`

- [x] 7. **Rehearsal (Opus).** Check that `eval_load` holds `syn-W2M-M` loaded plainly (load it plainly if not), and note the Redis database 0 key count and the `User` and `Post` counts of `public` and `eval_load`. Run `demo:start`, then follow `CHECKLIST.md` in one Chrome tab, with `peer.mjs` as window B. Write each step to `rehearsal.md` (step, what was done, expected, PASS or FAIL, evidence). Run `demo:stop`. A FAIL that is not a known bug gets a row in `.docs/Bugs Report.md` (§3 with a new ID, §6), and is not fixed here (Spec, Open question 4). (Design: Approach, "Rehearsal"; DW7, DW8.)

- [x] 8. **Acceptance and close (Opus).** Do the Acceptance items. Set `.docs/implementation-plan.md` §5 row 22 to ✅ with a change-log line. Fill the Result. Commit: `docs: p10-demo-script rehearsal and close`

## Tests

All tests are unit tests of `scripts/demo/lib.mjs` with `node:test` (no db, no Redis). Run them with `node --test` on `scripts/demo/`. The script itself (`demo.mjs`) talks to Docker and the servers, so it is checked by step 4 and the Acceptance items.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | unit | `rebaseIso` gives `YYYY-MM-DDTHH:MM:SSZ` in UTC: a `Date` with milliseconds is cut down (not rounded up) to the second; the result passes the loader's format (`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/`) |
| TC2 | DW5 | unit | `feedIds` returns the ids of `posts` in order; an empty page gives `[]`; a body with no `posts` array throws |
| TC3 | DW5 | unit | `pagesNotAllSame`: three equal lists → false; two equal and one different → true; three different → true; the same ids in another order → true |
| TC4 | DW5 | unit | `overlap` counts shared ids (0, some, all), order does not matter |
| TC5 | DW5 | unit | `orderCandidates`: "little" keeps history 1–4 only (0 and 5 are out), "long" keeps 20 and more (19 is out); a follow count of 0 is out in both; the sort is follow count high first, then id low first (a tie on follow count) |
| TC6 | DW5 | unit | `pickUser`: returns the first candidate that passes; skipped candidates are listed with their reason; it tries at most `max` (4) and returns "none" after that, so it never makes a fifth login |

## Acceptance

Claude does these after step 7, with the counts noted at the start of step 7.

- [x] A1 (DW1). `demo:start` with db and redis up and the ports free → exit 0; the output has the rebase time, `eval_demo`, Redis database 3, both URLs, the admin login and the two user logins; `/api/health` on :4000 and `/sign-in` on :3000 answer 200.
- [x] A2 (DW2). `demo:start` with the redis container stopped, and again with :4000 in use → each stops before the load with a message that says what to do; the `eval_demo` row counts are the same as before the try.
- [x] A3 (DW3). `test:parity` of the backend, with the demo running → passes.
- [x] A4 (DW4). Key count of Redis database 0 after start and some demo page views → the same as before start.
- [x] A5 (DW5). `demo:users` run twice → the same two users; one with history 1–4, one with 20 or more, each with at least one follow; for each, the three lists of 10 ids are not all the same order.
- [x] A6 (DW6). Login with each demo user's email and with `demo-admin@example.com`, password `password` → 200 with a `breadit_session` cookie.
- [x] A7 (DW7). In Chrome, Explore and For You with each `algo` for a demo user → 10 posts each; the newest is dated within the last day.
- [x] A8 (DW8). `rehearsal.md` → every checklist step has PASS and evidence; the DM and the notification arrived without a reload; the ban sent the tab to sign-in.
- [x] A9 (DW9). `demo:stop` after the rehearsal → :3000 and :4000 are free; Redis database 3 has 0 keys; no `eval_demo` user has `banned` true (SQL; a login is not needed, because the next start reloads the schema anyway); the `User` and `Post` counts of `public` and `eval_load` equal the counts noted in step 7.
- [x] A10 (DW10). `git diff` of the task's commits → no change under `apps/`, `packages/` or `eval/src/`; `CLAUDE.md`, `docs/System_Architecture.md` and both `04-data.md` files are updated.

## Result
Done 2026-11-22. Delivered: `npm run demo:start | demo:users | demo:stop` (`scripts/demo/demo.mjs`, `lib.mjs`), the presenter checklist `scripts/demo/CHECKLIST.md`, the rehearsal helper `peer.mjs`, the tryout record `tryout.md` and the rehearsal record `rehearsal.md`.

**Tests.** `scripts/demo/lib.test.mjs`: 22 `node:test` tests (TC1–TC6), 22 pass; they failed with `ERR_MODULE_NOT_FOUND` before `lib.mjs` existed. `verify.sh`: all 9 checks PASS (ranking 85, backend unit 211, IT 171, eval verify). `test:parity` with the demo running: 102 of 102 pass.

**Acceptance.** A1–A10 PASS:
- A1: `demo:start` took 17 s (40 s with a cold frontend build in the tryout).
- A2: both refusals (Redis stopped, :4000 in use) stop before the load; `eval_demo` was not reloaded.
- A4: Redis database 0 kept the same 31 keys, with the same MD5 of the key list.
- A5: two runs chose the same users, `u0000000787` (history 2) and `u0000000064` (history 28).
- A6: the three logins answered 200 (in the rehearsal and in `peer.mjs`).
- A9: after `demo:stop`, `public` (121 users, 930 posts) and `eval_load` (1000, 22,212) are unchanged, no user is banned and Redis database 3 has 0 keys.

**Commits.** `d907708` feat(demo): demo helpers and their tests · `115e0a0` feat(demo): demo start, users and stop commands · `92598d4` docs(demo): presenter checklist and rehearsal helper · `4d0d4bc` docs: demo commands and the eval_demo schema · the closing commit `docs: p10-demo-script rehearsal and close`.

**Different from the plan or the design** (none changes a DW):
1. The unit tests run with `node --test 'scripts/demo/*.test.mjs'`: Node 22 does not accept a folder there (`CLAUDE.md` says so).
2. The warm-up uses `/?feed=explore`, not `/explore`, because Explore is a tab of `/` and `/explore` would open the `[username]` page. It runs after the users step with a real session, and also warms the profile, messages, notifications and admin pages. So start makes 3 logins: the 2 users and the admin.
3. In `demo:users`, a candidate also fails when one of its three first pages has fewer than 10 posts (DW7). No candidate was skipped.
4. `docs/System_Architecture.md` also got the missing Redis database 2 row and a `scripts/demo/` entry in the tree.
5. A9 checks the ban by SQL (no `eval_demo` user has `banned` true), not by a new login, as the approved plan says.
6. The rehearsal drove the tab with JavaScript clicks from step 6a on, because the browser tool's mouse events stopped reaching the page (`rehearsal.md`). This is a tool problem, not an app bug.
7. The checklist got one more line after the rehearsal: the admin's For You is empty, so the presenter goes straight to the Admin Console, which opens Manage Users.

**Docs updated.** `CLAUDE.md`, `docs/System_Architecture.md`, `docs/Guidance-Manual/en/04-data.md`, `docs/Guidance-Manual/vi/04-data.md`, `.docs/implementation-plan.md` (§5 row 22, v1.25). No new bug in the Bugs Report.

**Open for the author.** Do one real pass of the checklist with two Chrome windows (normal and private) before 2026-11-30.
