# Plan: Security fixes before sharing the app

Status: approved · 2026-11-25
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-25-p10-security-fixes/`

Five fix groups in the order of the Design ("Answers to the open questions", 3): B1 + R6, S4, S6, B5, R3. Then the docs, then the close. Each group is tests first, then code, then one commit, so one group can be dropped alone. Needs `nvm use` (Node 22) and `docker compose up db redis -d` for the IT tests, the parity test and the loader. All commits go on `test-app` and are never pushed. Never `prisma db push`. Approving this plan approves the commits below.

## Steps

- [x] 1. **Baseline.** Build `@breadit/shared` and `@breadit/ranking`, then run the backend unit tests and the IT tests once and write the counts down (expected 211 and 171, Bugs Report §1). Run `npm audit` and keep the summary line (expected 54: 6 low, 19 moderate, 26 high, 3 critical). These numbers go in the Result. No commit.

- [x] 2. **B1 + R6 tests.** In a new `apps/backend/test/it/security-fixes.it-spec.ts` (helpers from `test/it/helpers/`, like `quick-wins.it-spec.ts`), write TC1–TC4. In `communities.service.spec.ts`, write TC5. Run them and see each fail for the right reason (201 or 500 where 400 is expected; the post soft-deleted; the self-ban 200). (Design: Approach, B1 and R6; Failure modes F14, F15.)

- [x] 3. **B1 + R6 code.** New `communities/dto/moderation.dto.ts` with `ModeratePostDto` and `PromoteMemberDto`; the two controller methods take `@Body() dto`; `moderatePost` gets the explicit `REMOVE` branch and a 400 after it, with the APPROVE path unchanged. `AdminService.setBanStatus(actorId, id, banned)` refuses self and admin targets before the update and the push; `admin.controller.ts` passes `req.user!.id`. Run the unit tests and all IT tests (the `demo-fixes` V3 and V4 tests must stay green). (Design: Approach, B1 and R6; Code files.) Commit: `fix(security): B1 moderation and promote DTOs, R6 admin cannot ban self or admins`

- [x] 4. **S4 tests.** New `apps/backend/src/uploads/media-types.spec.ts` with TC6. In `security-fixes.it-spec.ts`, TC7 and TC8 (local disk: the IT env has no Cloudinary). See them fail. (Design: Approach, S4; Failure modes F8.)

- [x] 5. **S4 code.** New `uploads/media-types.ts` (`VIDEO_EXT`, `mediaKind`). In `uploads.service.ts`: the type check at the top of `saveFile`, the video extension from `VIDEO_EXT`, a `sharp` error → 400 with nothing written, `isVideo` through `mediaKind`. In `app.setup.ts`: `setHeaders` with `X-Content-Type-Options: nosniff`. Run the unit and IT tests (`avatar.it-spec.ts` and the post and comment media tests must stay green). (Design: Approach, S4; Code files.) Commit: `fix(security): S4 uploads keep only image and video types, nosniff on /uploads/`

- [x] 6. **S6 tests.** New `auth/auth.config.spec.ts` with TC9. A new `auth/auth.service.spec.ts` (Prisma and Redis stubs) with TC10 and TC15. In `auth/session.spec.ts`, TC12 (the existing S5 cases stay and are moved to the new signature in step 7). In `security-fixes.it-spec.ts`, TC11, TC13 and TC14. See them fail. (Design: Approach, S6 parts 1–4; Failure modes F1–F5, F7.)

- [x] 7. **S6 code.** In this order:
  1. `schema.prisma`: `User.passwordVersion Int @default(0)`, and a real migration named `user_password_version` made with `prisma migrate dev` (from the repo root, with `--schema`); then `prisma generate`. (Design: Data, schema and cache changes.)
  2. New `auth/auth.config.ts` (`JWT_SECRET_MIN_LENGTH`, `readJwtSecret`); `getJwtSecret` uses it; `main.ts` calls it first in `bootstrap()`.
  3. `auth.service.ts`: the code from `randomInt` (exported as a module function so TC10 can call it); the per-email tries in `verifyEmail` (`VERIFY_TRIES_PREFIX`, `VERIFY_MAX_TRIES = 5`, 900 s, 429); the `pwv` claim at login (select `passwordVersion`); in `resetPassword` the increment in the same update, then `setMax`, and on its error a delete of the key (F1).
  4. `session.ts`: `readSession(token, redis, versionOf)` with one `MGET`, `passwordVersionOf(prisma)`, `setMax` (Lua, 3600 s); a missing claim is 0, a `null` version is no session.
  5. `jwt.guard.ts`, `optional-jwt.guard.ts` inject `PrismaService`; `notifications.gateway.ts` `authenticate` calls `readSession`.

  Run the unit tests and all IT tests (the S5 tests in `quick-wins.it-spec.ts` and `socket.it-spec.ts` must stay green). (Design: Approach, S6; Sequence diagrams 1–3; Code files.)

- [x] 8. **S6: the eval schema.** The parity setup never migrates (Failure modes F11). Load `syn-W2M-M` into `eval_load` again with the loader (no `--rebase-to`), run `load:check` (the six hashes must equal the manifest), then `test:parity` (102/102). If `load:check` is not equal, stop and report: do not change the loader. Commit steps 6–8 (the migration folder included). Commit: `fix(security): S6 JWT secret check, crypto codes, per-email tries, a reset ends old sessions`

- [x] 9. **B5 tests.** New `auth/email-verified.guard.spec.ts` with TC17. In `security-fixes.it-spec.ts`, TC16. See them fail. (Design: Approach, B5.)

- [x] 10. **B5 code.** `email-verified.guard.ts` injects `PrismaService` and reads the database only for an unverified token. In `apps/frontend/src/app/(board)/layout.tsx`, the banner link carries `?email=` (encoded). Run the unit and IT tests and the frontend typecheck and lint. (Design: Approach, B5; Code files.) Commit: `fix(security): B5 a newly verified user can post with the same cookie; banner link with the email`

- [ ] 11. **R3.** At the root, `npm audit fix` with `--legacy-peer-deps` and never `--force`. In `apps/frontend/package.json`, `next` and `eslint-config-next` to `15.5.29`, still exact. Then a clean install and `prisma generate`. Run `npm audit` again and save its full text output as `audit-after.txt` in the task folder. Run the frontend build, lint and typecheck, the backend build, `verify.sh` and `test:parity`. Read the `package-lock.json` diff for `@prisma/client` and write any change of its version in the Result (Failure modes F13). If the frontend build breaks on Next 15.5 and the fix is not a one-line change, put `next` and `eslint-config-next` back to 15.1.0, keep the `audit fix` part, and report it (F12). (Design: Approach, R3.) Commit: `chore(deps): R3 npm audit fix and next 15.5.29`

- [ ] 12. **Docs.** (Design: Code files, the doc rows.)
  - `.docs/Bugs Report.md`: B1, S4, S6, B5, R3 and R6 to a new §5.6 "Security fixes (task `p10-security-fixes`, 2026-11-25)" with what changed and the test names; §1 counts (resolved 34 → 40, open 14 → 8, P1 = 1, P2 = 0, P3 = 1, P4 = 6); §3.2 empty with a pointer to §5.6; R6 out of §3.3; §6 row "P10, before sharing the app" done; the R3 leftovers from `audit-after.txt`; F6 (the 15-minute wait) on the S6 row.
  - `.docs/implementation-plan.md`: §5 row 29 ✅ 11-25, and a change-log line.
  - The thesis, `.docs/Thesis-Report/chapters/` and the same text in `drafts/`: Chapter 4 NFR1 (a reset ends every older session) and NFR3 (the email code is also limited per email), and the "known gap" item at line 224 removed or turned into the rule; Chapter 8 line 126 (8 open items, all future work; the six are fixed); Chapter 9 line 71 (the sentence on the six items goes; the sentence on the two missing kinds of test stays). No result number changes.
  - `docs/Guidance-Manual/en/12-platform-and-real-time.md` and the same places in `vi/`: `readSession` also checks `pwv`, a reset ends older sessions, `EmailVerifiedGuard` reads the database for an unverified token, the socket uses `readSession`.
  - `docs/System_Architecture.md`: the Redis row (line 238) adds the `pwv` copy and the verify tries.
  - `CLAUDE.md`, Auth: `JWT_SECRET` (at least 32 characters) is required with `NODE_ENV=production`; a reset ends older sessions (`User.passwordVersion`, claim `pwv`, Redis copy `auth:pwv:<userId>`).

  Build the thesis PDF and run `thesis:check`. Commit: `docs: p10-security-fixes in the Bugs Report, the thesis and the manuals`

- [ ] 13. **Acceptance and close (Opus).** Do the Acceptance items. Fill the Result. Commit: `docs: p10-security-fixes close`

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW1 | IT | A mod moderates a pending community post with `{"action":"APROVE"}`, then `{}` → 400 both; `deletedAt` stays null. Then `{"action":"APPROVE"}` → 201 (regression). |
| TC2 | DW2 | IT | The owner promotes a member with `{"role":"ADMIN"}` → 400; with `{"role":"MOD"}` → 201 and the role is `MOD` (regression); with `OWNER` → 403 as before. |
| TC3 | DW3, F15 | IT | An admin bans their own id → 400; bans another admin → 400; `banned` stays false for both; a socket of the target gets no `accountBanned`. |
| TC4 | DW4 | IT | An admin bans a normal user → 200 and `banned = true`; unban → 200 (regression). |
| TC5 | B1 | unit | `moderatePost` called directly with an action that is not `APPROVE` or `REMOVE` → `BadRequestException`, and `post.update` is never called. |
| TC6 | S4 | unit | `mediaKind`: `image/png` → image; `video/mp4`, `video/webm`, `video/quicktime`, `video/ogg` → video; `text/html`, `application/octet-stream`, `''` → null. `VIDEO_EXT` gives `.mp4` for `video/mp4`. |
| TC7 | DW5, F8 | IT | `POST /api/uploads` with a file named `evil.html` typed `video/mp4` → 201 and the stored name ends with `.mp4`; typed `text/html` → 400; a text file typed `image/png` → 400; in both 400 cases, no new file in the upload folder. |
| TC8 | DW6 | IT | `GET /uploads/<the file of TC7>` → 200 with `X-Content-Type-Options: nosniff`. |
| TC9 | DW7 | unit | `readJwtSecret`: production with the secret unset, empty, or 31 characters → throws a message that names `JWT_SECRET`; production with 32 characters → returns it; not production and unset or empty → the dev value. |
| TC10 | DW8 | unit | The code function: 1,000 calls give strings of 6 digits from `100000` to `999999`; the source text of `auth.service.ts` has no `Math.random`. |
| TC11 | DW9, F7 | IT | For one unverified user, 5 wrong codes → 400 each; the 6th request with the right code → 429 and the user is still unverified; after deleting the tries key (as if 15 minutes passed), the right code → 200. A right code on an early try deletes the key. |
| TC12 | F3, F4, F5 | unit | `readSession` with stubs: a token with no `pwv` and version 0 → user; `pwv` 0 and version 1 → null; the copy missing → `versionOf` called once and `setMax` called with that value; the copy present → `versionOf` not called; `versionOf` gives null → null; `versionOf` throws → the error goes up; a blacklisted `jti` → null (S5 case kept). |
| TC13 | F2 | IT (real Redis, database 1) | `setMax` writes 2, then 1 → 2 stays and the life is renewed; on an empty key, 1 → 1. |
| TC14 | DW10, F16 | IT | Sign in (cookie A); take the reset token from `VerificationToken`; reset the password; with cookie A, `/api/auth/me` → 401 and `POST /api/posts` → 401; a socket handshake with cookie A is refused; a new sign-in with the new password → 200 and its cookie works on `/me`. |
| TC15 | F1 | unit | `resetPassword` with a Redis stub whose `setMax` throws → the key is deleted, and the call still returns `{ ok: true }`. |
| TC16 | DW11 | IT | An unverified user signs in (cookie A); `POST /api/posts` → 403; they verify with the code from `VerificationToken`; `POST /api/posts` with cookie A → 201. |
| TC17 | B5 | unit | `EmailVerifiedGuard`: a token with `emailVerified` set → pass with no Prisma call; null in the token and set in the database → pass and `req.user.emailVerified` is filled; null in both → `ForbiddenException`. |

## Acceptance

Claude does these after step 12.

- [ ] A1 (DW14). `verify.sh` → all checks PASS; the unit and IT counts are higher than in step 1 by the new tests.
- [ ] A2 (DW14, F11). `load:check` on `eval_load` → the six hashes equal; `test:parity` → 102/102.
- [ ] A3 (DW1, DW3). Backend from `run-safe.sh` on the dev data: a moderate request with `"APROVE"` → 400; an admin ban of `admin` itself → 400; then stop the backend.
- [ ] A4 (DW7). Start the built backend with `NODE_ENV=production` and a 10-character `JWT_SECRET` → it exits at once with the `JWT_SECRET` message; with no `NODE_ENV` it starts.
- [ ] A5 (DW12). In Chrome, an unverified user: the banner link is `/verify?email=<their email>` and the page shows the code form, not "No email provided".
- [ ] A6 (DW15). `demo:start`, every step of `scripts/demo/CHECKLIST.md` (the three `algo`, a direct message, a notification, the ban that logs out), `demo:stop` → all pass.
- [ ] A7 (DW13). `audit-after.txt` → fewer than 54 issues and no critical one in a backend package; every issue left is in the Result with its reason (a major version, no fix, or an unused package).
- [ ] A8 (DW16). `thesis:check` → exit 0, `0 FAIL`, the page count still under the limits; the thesis no longer calls B1, S4, S6, B5, R3 or R6 open.
- [ ] A9 (F9). List the files of the local upload folders (`apps/backend/uploads/` and `UPLOAD_DIR` if set) whose extension is not `.jpg` or in `VIDEO_EXT` → the list (or "none") is in the Result; nothing is deleted.
- [ ] A10. `git status` clean after the close commit; no change under `docs/Pre-thesis/`, `eval/`, `packages/ranking/` or `.docs/results/`.

## Result

(Filled in at the end.)
