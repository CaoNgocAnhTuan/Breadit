# Plan: Demo sweep before the demo script

Status: approved · 2026-11-20
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-20-p10-demo-sweep/`

This task changes no code (DW9). Steps 1–3 are for Sonnet; steps 4–7 are done by Opus, because the Chrome tab group belongs to the main session (Design: Approach, "Who does what"). Docker db and redis must run. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Sweep record skeleton.** Write `sweep.md` in the task folder: setup (backend, frontend, users), the 28 page rows (page, user kind, the real id used for a dynamic page, expected result), the 15 flow rows W1–W15 with the expected results of the Design table, a row for DW1, and a cleanup row (unban `user1`, unblock `user2`). Each row has empty "Result", "How clicked" and "Evidence" columns. Read the page list from `apps/frontend/src/app/**/page.tsx` and pick the real ids from the database (schema `public`, read only). (Design: Approach "Pages", "Flows"; Code files `sweep.md`.)

- [x] 2. **Second-user script.** Write `second-user.mjs` in the task folder: it signs in `user2` and `admin` once (F2), keeps the cookies in memory, and runs one action per command (`dm`, `typing`, `like`, `join`, `post-in-community`, `ban`, `unban`), printing each HTTP status. Use the routes named in the Design (W10 and W13 diagrams) and read the others from the controllers. Try each command once against the backend from `run-safe.sh`, except `ban` (try `ban` and then `unban` on a throwaway user created for the try, never on `user1`). Write the outputs into `sweep.md` under setup. (Design: Approach "Second user"; F2, F6.)

- [x] 3. **DW1.** Run `scripts/verify-bug-sweep.sh` against a fresh backend from `run-safe.sh` and write the totals and any FAIL into the DW1 row. Stop the backend after. Commit steps 1–3. (Design: Approach; DW1.) Commit: `docs: p10-demo-sweep record skeleton, second-user script, verify scripts run`

- [ ] 4. **Pages (Opus).** Start the backend and the frontend (Design: Approach "Setup"). Open each of the 28 pages with its user and fill its row: status, crash text, console errors, how clicked (F1, F3, F7). (Design: Approach "Pages"; DW2.)

- [ ] 5. **Flows (Opus).** Do W1–W15 in order, with `second-user.mjs` for the second user, and fill each row (F4, F6, F8, F9, F10). (Design: Approach "Flows"; DW3–DW6.)

- [ ] 6. **Cleanup (Opus).** Whatever happened before, unban `user1` and unblock `user2`, check that `user1` can sign in, then stop the backend and the frontend and close the Chrome tab. Tick the cleanup row. (Design: F5.)

- [ ] 7. **Bugs and docs (Opus).** Each FAIL that is not a known open bug becomes a V-series row in `.docs/Bugs Report.md` §3 and is placed in §6; a FAIL that is a known bug is noted in `sweep.md` with its ID; update §1 (or add the line "the sweep found nothing new"). Set `.docs/implementation-plan.md` §5 row 21 to ✅ with a change-log line. Commit: `docs: p10-demo-sweep results and new bugs`

## Tests

This task has no automatic tests: it changes no code. Its checks are the rows of `sweep.md`, and the Acceptance items below cover every DW.

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | script | `verify-bug-sweep.sh` with the socket checks: 95 passed, 0 failed |

## Acceptance

- [ ] A1 (DW1). The DW1 row of `sweep.md` → 95 passed, 0 failed.
- [ ] A2 (DW2). The 28 page rows → each has a result and evidence; every FAIL has a Bugs Report ID.
- [ ] A3 (DW3). The flow rows W1–W15 → each has a result and evidence; every FAIL has a Bugs Report ID.
- [ ] A4 (DW4). W2 → the first ten post ids of Chronological, Engagement and Social are not all the same (or the row explains F9).
- [ ] A5 (DW5). W10 and W11 → the message and the notification appeared without a reload.
- [ ] A6 (DW6). W13 → `user1`'s page went to sign-in after the ban, and `user1` can sign in after the unban.
- [ ] A7 (DW7, DW8). `sweep.md` is complete; the Bugs Report has the V rows and the §1 counts (or the "nothing new" line).
- [ ] A8 (DW9). `git diff` of the task's commits → no change under `apps/`, `packages/` or `eval/`.

## Result
