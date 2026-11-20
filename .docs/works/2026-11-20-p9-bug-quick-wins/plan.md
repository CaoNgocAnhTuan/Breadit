# Plan: Bug quick wins before the demo

Status: approved · 2026-11-20
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-20-p9-bug-quick-wins/`

Every step writes its tests first and sees them fail for the right reason, then writes the code. Backend steps need Docker db and redis for the IT tests. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Session check (S5).** Write TC1 (unit, `auth/session.spec.ts`) and TC2 (IT, in the new `test/it/quick-wins.it-spec.ts`). Then add `auth/session.ts` with `readSession` and `SessionUser`, make `JwtAuthGuard` use it (401 on `null`), and make `OptionalJwtAuthGuard` inject `RedisService` and use it (guest on `null` or on an error). (Design: Approach "One session check"; Code files `session.ts`, `jwt.guard.ts`, `optional-jwt.guard.ts`; F1, F2.) Commit: `fix(auth): optional guard checks the logout blacklist (S5)`

- [x] 2. **Pending posts (R2).** Write TC3 (IT). Then add `posts/visibility.ts` with `canSeePost`, make `PostsService.findOne` call it and remove the private `canSeePending`, give `InteractionsService.assertPostLive` the viewer id and the visibility check, and add `assertPostVisible` to `CommentsService.create`, `findByPost` and `toggleLike`. Keep the existing visibility IT tests (`visibility.it-spec.ts`) green. (Design: Approach "One visibility check"; Code files `visibility.ts`, `posts.service.ts`, `interactions.service.ts`, `comments.service.ts`; F4, F5.) Commit: `fix(posts): no likes, saves, reposts or comments on a pending post (R2)`

- [ ] 3. **Comments (N2, R1).** Write TC4 and TC5 (IT). Then import `BlockModule` in `CommentsModule`, inject `BlockService` into `CommentsService`, add the blocked-peer filter at every level of `findByPost`, and count only live replies in `commentInclude`. (Design: Approach "Comments"; F6, F7, F8.) Commit: `fix(comments): hide blocked users and count live replies only (N2, R1)`

- [ ] 4. **Trending, unread count, slug (B7, B10, B2).** Write TC6, TC7 and TC8 (IT). Then add the post filter and the 60 s `getOrSetJson` to `HashtagsService.getTrending` (and `CacheModule` to `HashtagsModule`), delete `dm:unreadCount` for the reader in `MessagesService.getMessages`, and add `@Matches` to `CreateCommunityDto.slug`. TC6 must not depend on the cache: the IT app may run with the cache on, so the test reads trending once, after all its posts exist, or uses tags no other test uses. (Design: Approach "Trending", "Unread count", "Slug"; F9, F10, F11, F16.) Commit: `fix(api): trending counts live posts, unread count clears, slug format (B7, B10, B2)`

- [ ] 5. **Existing unit tests.** Run all backend unit tests. Fix the specs that build `PostsService`, `CommentsService`, `HashtagsService` or a guard by hand (new constructor arguments), and check `banned-guard-coverage.spec.ts`. No behaviour change in this step. If there is nothing to fix, there is no commit. (Design: Code files, the note under the table.) Commit, if needed: `test: specs for the new constructor arguments`

- [ ] 6. **Frontend (B9, N5, N8).** No automatic tests (the frontend has none); the checks are Acceptance A1–A3. Change the Explore link in `LeftBar.tsx`; replace the `<Link>` around the post text in `Post.tsx` with the clickable `div` (click, Ctrl/Cmd-click and middle click, Enter, text selection, as in F12); move `@modal/compose/post/page.tsx` to `@modal/(.)compose/post/page.tsx` and add `(board)/compose/post/page.tsx` with the compose box and a close button to `/`. Frontend typecheck and lint must pass. (Design: Approach "Frontend"; F12–F15.) Commit: `fix(frontend): Explore link, no nested links in posts, compose page (B9, N5, N8)`

- [ ] 7. **Script (R7).** Remove `dev:reset` from the root and frontend `package.json`, and rewrite README line 88 so it names only the right commands. Search the repo (outside `docs/Pre-thesis/`) for other mentions. (Design: Approach "R7"; F17.) Commit: `chore: remove the script that ran db push (R7)`

- [ ] 8. **Docs.** Update `.docs/Bugs Report.md` (the eleven rows move to §5 with their commits, §1 counts, §2 suggested order, §6 row "P9, before the demo" done, §7 README items done); Chapter 4 NFR2 in `chapters/system-analysis-and-design.tex` and the draft (the S5 HTTP part is fixed); the S1/S5 row of `docs/Guidance-Manual/en/09-glossary.md` and `vi/09-glossary.md` (both parts of S5 fixed); `.docs/implementation-plan.md` §5 row 20 ✅ with a change-log line. Check that `docs/System_Architecture.md` names none of these bugs. Commit: `docs: p9-bug-quick-wins in the Bugs Report, Chapter 4 and the glossary`

## Tests

All IT tests are in `apps/backend/test/it/quick-wins.it-spec.ts`, except TC1. Each test makes its own users and posts with the factory helpers (`createUserWithCookie`, `uniq`).

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW2 | unit | `readSession`: a good token gives the user; a bad or expired token gives `null`; a blacklisted `jti` gives `null`; a token with no `jti` skips the Redis read; a Redis error is thrown to the caller |
| TC2 | DW2 | IT | log in through `POST /api/auth/login`, like a post, log out; `GET /api/posts/<id>` with the old cookie answers 200 with no like of that user (a guest answer); a protected route still gives 401 |
| TC3 | DW1 | IT | a pending community post: a plain member gets 404 on like, save, repost, quote repost, comment, read comments and like a comment; the author and a mod get 200/201 on like and comment |
| TC4 | DW3 | IT | carol blocks dave; dave comments on bob's post and replies to another comment; carol's comment list has neither; bob's list has both |
| TC5 | DW4 | IT | a comment with two replies, one deleted: `_count.replies` is 1 in the comment list |
| TC6 | DW5 | IT | one new tag on live posts outside communities, on deleted posts, and on community posts: trending shows only the live count for it |
| TC7 | DW6 | IT | bob sends alice two messages; alice's list shows `unreadCount` 2; she opens the thread; the list then shows 0 |
| TC8 | DW7 | IT | `POST /api/communities` with slug `Has Space/And Slash` gives 400; with `good_slug-1` gives 201 |

The other DW rows are Acceptance items (A1–A6).

## Acceptance

Claude does these after Step 8, with db and redis up.

- [ ] A1 (DW8, B9). In Chrome, the Explore item of the left bar → opens `/?feed=explore` with the Explore tab active.
- [ ] A2 (DW9, N5). In Chrome, the home feed with a post that has a mention and a tag → no "`<a>` cannot be a descendant of `<a>`" and no hydration error in the console; a click on the text opens the post; a click on the mention opens the profile; Cmd-click on the text opens a new tab.
- [ ] A3 (DW10, N8). In Chrome, the Post button of the left bar → the compose modal over the feed; reload → the compose page (no 404); with curl and a session cookie, `GET /compose/post` → 200.
- [ ] A4 (DW11, R7). `npm run` at the root and in `apps/frontend` → no `dev:reset` in the list.
- [ ] A5 (DW12, DW13). `verify.sh` → all green; `test:parity` (needs `syn-W2M-M` in `eval_load`; load it first if the schema is empty) → passes.
- [ ] A6 (DW14). `scripts/verify-bug-sweep.sh` against a fresh backend from `run-safe.sh` → no check that passed before fails now (compare with `works/2026-10-21-bugs-sweep/sweep-after.txt`).

## Result
