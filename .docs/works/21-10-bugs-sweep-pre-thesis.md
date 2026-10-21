# Bug sweep before the thesis phase: plan

2026-10-21 · status: **done** · branch `thesis` · result in section 10

Sources: [Pre-thesis check.md](../Pre-thesis%20check.md) (findings and evidence), [Pre-thesis verify.md](../Pre-thesis%20verify.md) (the run), [super-plan.md](../super-plan.md) (phases P0–P9).

---

## 1. Context

The pre-thesis app works, but the run found 36 problems. 14 of them sit on the thesis path, crash pages, or leak data, and each fix is small. We fix those now so the thesis phase (P0 onward) starts from a clean base. The rest are already planned in P2, P6 and E7, or are left as known limits (section 9).

**Decisions already made by the author:**
- S1 (socket hijack) is **in** this pass.
- Tests: **Jest unit tests and integration tests (IT)**, plus a committed curl script.
- Git: tag `6f7b884` as `v1-prethesis`, create branch `thesis`, one commit per fix group.

**Done when:**
1. Every fixed ID has an IT (or unit test) that **failed before** the fix and **passes after**.
2. The curl script prints only PASS for the 14 items. Before the fixes it shows FAIL for them.
3. `npm run typecheck`, `npm run lint` and `npm run build -w @breadit/backend` pass.
4. The 72 routes are still mapped, and migrate and seed still pass on an empty database.
5. Each fix has a line in `.docs/prethesis-corrections.md`.

---

## 2. Issues in this pass

| ID | Problem (short) | Evidence from the run |
|---|---|---|
| T1 | Repost count and "I reposted" flag count soft-deleted reposts | After un-repost, `_count.rePosts` stayed 1. UI showed 1 and a green icon after reload. |
| T2 | Comment count includes deleted comments | Count stayed 2 after deleting a reply; thread showed 1. |
| T5 | Self-follow and self-block allowed. Unknown user ID gives 500. | Self-follow made a row. |
| T7 | Missing or deleted posts and comments are not checked. Bad IDs and cursors give 500. | Like on a missing post: 500. Like, save, repost and comment on a deleted post: success. `/api/posts/abc`: 500. |
| T8 | "Popular users" sorted by the wrong number | Recommendations: user32, user3, user48. Real top: user16, user40, user31. |
| T9 | Recommendations and Connect show blocked and banned users | Blocked user32 still listed. |
| T10 | Posts waiting for approval are readable by URL and in the Likes tab | Outsider got post 901. Likes tab showed pending post 883. |
| S1 | Any logged-in socket can join another user's room and read their DMs | alice read bob's DM. Fake notification reached carol. |
| S2 | `GET /api/users/:username` returns email, role and banned to anyone | Logged-out request returned bob's email. |
| S3 | Banned users can still post, comment, upload, DM and create communities | All five returned 201 for a banned user. |
| N4 | Any text is accepted as avatar or cover URL. Bad host crashes pages. | `evil.example` avatar made other users' `/notifications` return 500. |
| N1 | Empty post and empty comment accepted | Post 885 and comment 754 created. |
| B3 | Too-long text gives 500 | 300-char post, 1,200-char comment: 500. |
| B4 | Feed fetch ignores HTTP errors | A 429 showed "Something went wrong" crash screen. |

Also in this pass (no separate finding): fix the seed line in CLAUDE.md, add the test commands to CLAUDE.md, and write `.docs/prethesis-corrections.md`.

**Not touched here:** database schema and migrations (P2), ranking code (P6), the cache and `Date.now()` (P6, E7). See section 9.

---

## 3. Order of work

Each row is one commit on branch `thesis`. Tests are written first for each group (red), then the fix (green).

| Step | Commit | IDs | Rough time |
|---|---|---|---|
| 0 | Prep (needs your OK) | save plan, tag, branch, commit `.docs/` | 15 min |
| 1 | `test: add jest setup and verify scripts` | none | 3–4 h |
| 2 | `fix: input checks and error codes` | T7, B3, N1 | 1.5 h |
| 3 | `fix: count only live reposts and comments` | T1, T2 | 1 h |
| 4 | `fix: follow, block and recommendation rules` | T5, T8, T9 | 1 h |
| 5 | `fix: hide pending posts, private fields, banned writes` | T10, S2, S3 | 1.5 h |
| 6 | `fix: validate avatar and cover URLs` | N4 | 1 h |
| 7 | `fix: socket auth` | S1 | 2 h |
| 8 | `fix: feed error handling, docs` | B4, docs | 1 h |
| 9 | Final verification | all | 1 h |

About 1.5 to 2 days in total. This is more than the earlier "one day" because tests and the verify scripts are included.

### Step 0: Prep (git steps need your OK)
1. Save this plan to `.docs/works/21-10-bugs-sweep-pre-thesis.md`.
2. `git tag v1-prethesis 6f7b884`, then `git switch -c thesis` (from `9606923`). No push.
3. Commit the `.docs/` files (check, verify, works, plan) as `docs: add pre-thesis check, verify and bug sweep plan`.
4. No code is changed in Step 0.

---

## 4. Step 1: test setup (no behavior change)

**Dependencies** (backend `devDependencies` only): `jest`, `ts-jest`, `@types/jest`, `@nestjs/testing@^10`, `socket.io-client@^4`. No supertest: we use Fastify `inject` (`light-my-request` is already installed).

**Files:**
- `apps/backend/jest.config.ts`: two projects. `unit` = `src/**/*.spec.ts`. `it` = `test/it/**/*.it-spec.ts`, run in band. `tsconfig.build.json` already excludes `*spec.ts` from the build.
- `apps/backend/package.json` scripts: `test` (unit), `test:it` (integration).
- Root `package.json`: `test:backend` runs both. (Root `test` is not used, because root scripts target the frontend.)
- `apps/backend/src/app.setup.ts`: move the plugin and pipe setup out of `main.ts` into `setupApp(app, uploadDir)` (cookie, multipart, static, CORS, websocket adapter, `ValidationPipe`, `AllExceptionsFilter`). `main.ts` calls it. Same behavior; ITs reuse it, so they test the real configuration.
- `apps/backend/test/it/global-setup.ts`: set test env, run `prisma migrate deploy` on schema `it_test`, then `TRUNCATE` all tables except `_prisma_migrations` (removes the `humans_v1` rows).
- `apps/backend/test/it/helpers/`:
  - `app.ts`: `createTestApp()` boots `AppModule` with `FastifyAdapter` and `setupApp`. A small `http(app)` wrapper over `inject` with a cookie option and JSON or multipart bodies.
  - `factory.ts`: `createUser({ username, verified, role, banned })` with explicit IDs via Prisma, and `cookieFor(user)`. It signs a JWT with `jose` and the same claims as `auth.service.ts`. This avoids the 10-per-minute login limit.
  - `multipart.ts`: tiny multipart body builder (post and comment routes read multipart).
  - `socket.ts`: listen on an ephemeral port and connect `socket.io-client` with a cookie.

**Test environment** (set in global setup, no `.env` needed):
- `DATABASE_URL=postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=it_test`. The dev data in schema `public` is not touched.
- `REDIS_URL=redis://localhost:6378/1` (Redis database 1), flushed before each suite.
- `REDIS_HTTP_CACHE_ENABLED=false`, fixed `JWT_SECRET`, SMTP pointed at a dead port, Cloudinary empty, `UPLOAD_DIR` in the OS temp folder.
- Needs `docker compose up db redis -d`.

**Verify scripts (written in this step, before any fix):** `scripts/verify-bug-sweep.sh` and `scripts/verify-socket.cjs` (details in section 8). The rows for the 14 IDs are written now with the **expected-after-fix** results. Run them on the unfixed code and save the output as the "before" record (in `.docs/prethesis-corrections.md`). The "still works" rows must already PASS.

**Check for this step:** `npm run build -w @breadit/backend` passes, the backend starts with 72 mapped routes, one trivial IT (`GET /api/health` returns 200) passes, and the verify scripts show FAIL for the 14 IDs and PASS for the "still works" group.

---

## 5. Fix steps

For each group: what changes, then tests. "IT" = integration test through the real app and real Postgres. Test names are `<ID>: <what>`.

### Step 2: input checks and error codes (T7, B3, N1)

**Changes**
1. `src/common/pipes/positive-int.pipe.ts`: `PositiveIntPipe` (400 if not an integer ≥ 1) used with `DefaultValuePipe(1)` on every `cursor` query. Replace `parseInt(cursor ?? '1', 10)` in `users.controller.ts` (5 sites), `admin.controller.ts` (2), `notifications.controller.ts`, `messages.controller.ts` (2), and `Number(cursor)` in `hashtags.controller.ts`.
2. `ParseIntPipe` on `:id` in `posts.controller.ts` (`findOne`, `remove`) and `interactions.controller.ts` (3 routes). Drop `Number(id)` and `+id`.
3. `all-exceptions.filter.ts`: map Prisma errors. `P2025` → 404, `P2003` → 404 "Referenced record not found", `P2002` → 409, `P2000` → 400 "Value too long", `PrismaClientValidationError` → 400. 5xx logging stays for everything else. This also turns the other 500s (follow, block or DM with an unknown user, unban of a user who is not banned, bad `rePostId`) into 404 or 400.
4. `interactions.service.ts`: new private `assertPostLive(postId)` (`findFirst` with `deletedAt: null`, else `NotFoundException`) used by `toggleLike`, `toggleSave`, `toggleRepost`.
5. `comments.service.ts`: `create` also rejects a post with `deletedAt`. `toggleLike` rejects a comment with `deletedAt`.
6. `posts.service.ts` `createReport`: post must exist and be live. New `ReportDto` (`@IsString @IsNotEmpty @MaxLength(500) reason`) replaces the inline body type in `posts.controller.ts`.
7. `src/common/limits.ts`: `POST_DESC_MAX = 255`, `COMMENT_BODY_MAX = 1000`, and `codePointLength()`. Checked in `PostsService.create` and `update`, `CommentsService.create` and `update`, and `RepostDto.desc` (`@MaxLength(255)`). Over the limit gives 400. The Prisma `P2000` mapping stays as a safety net.
8. N1: `posts.controller.ts` `create` returns 400 "Post must have text or media" when `desc` is empty, there is no file, and no `rePostId`. `comments.controller.ts` `create` returns 400 for an empty body with no file.

**Unit tests** (`src/**/*.spec.ts`)
- `all-exceptions.filter.spec.ts`: table of error to status (P2025, P2003, P2002, P2000, validation error, `HttpException` passthrough, unknown error gives 500 and "Internal server error").
- `positive-int.pipe.spec.ts`: `abc`, `0`, `-1`, `1.5` give 400. `'2'` gives 2. Missing gives the default.
- `limits.spec.ts`: `codePointLength('😀')` is 1.

**IT** (`test/it/input-errors.it-spec.ts`)
- T7: `GET /api/posts/abc` 400. `GET /api/posts/99999999` 404. Like, save and repost on a missing post 404. The same three on a soft-deleted post 404. Comment on a deleted post 404. Comment like on a deleted comment 404. Report on a missing post 404, report with no reason 400. Quote repost with a missing `rePostId` 404. `?cursor=abc` on notifications, admin users, profile posts, hashtag posts and messages: 400.
- B3: 300-char post 400. 1,200-char comment 400. 400-char quote repost 400. 255-char post 201.
- N1: empty post 400. Post with a file only 201. Empty comment 400. Plain repost (`rePostId`, no text) 201.

**Curl** (script rows): `/api/posts/abc` 500→400; like on missing post 500→404; like on deleted post 200→404; comment on deleted post 201→404; report with no reason 500→400; `/api/notifications?cursor=abc` 500→400; 300-char post 500→400; 1,200-char comment 500→400; empty post 201→400; empty comment 201→400.

### Step 3: counts (T1, T2)

**Changes**
- New `src/posts/engagement.ts` with `engagementSelect(userId?)`. It returns the shared part of every post include:
  - `_count: { likes: true, rePosts: { where: { deletedAt: null } }, comments: { where: { deletedAt: null } } }`
  - `likes`, `rePosts` (with `deletedAt: null`) and `saves` flags for the viewer.
  - A comment says: "comments = non-deleted Comment rows of the post, replies included".
- Use it in the four places that repeat this include: `posts.service.ts` (`postInclude`), `users.service.ts` (`postInclude`), `search.service.ts`, `hashtags.service.ts`. Each keeps its other fields (`media`, `mentions`, `community`).
- The Explore score reads these counts, so it is fixed too. `computeExploreScoreFixed` is not changed.

**Unit test:** `engagement.spec.ts`: the returned shape has `deletedAt: null` on `rePosts` and `comments`, and no viewer flags for guests.

**IT** (`counts.it-spec.ts`)
- T1: A posts. B reposts (`rePosts` count 1, flag set), B un-reposts (`GET /api/posts/:id` as B gives `_count.rePosts` 0 and empty flag), B reposts again (count 1; exactly one live row). Same for the feed, search and a hashtag page.
- T1b: a quote repost still counts.
- T2: A comments, B replies, B deletes the reply: `_count.comments` is 1. A deletes the comment: 0.
- Explore: with two posts that differ only by a deleted repost, the order matches the live counts.

**Curl:** repost, un-repost, `GET /api/posts/:id`: `rePosts` 1→0. Comment, reply, delete reply: `comments` 2→1.

### Step 4: follow, block and recommendations (T5, T8, T9)

**Changes** (`users.service.ts`)
- `toggleFollow`: same user gives `BadRequestException("You cannot follow yourself")`. Unknown target gives `NotFoundException` (one `findUnique`).
- `toggleBlock`: same two checks. The `block.create` and `follow.deleteMany` run in `$transaction`.
- `getRecommendations` and `getConnectUsers`: order by `{ followings: { _count: 'desc' } }` then `{ id: 'asc' }` (stable pages). Exclude `blockService.getAllBlockedPeerIds(userId)` and `banned: true`. Connect keeps the response field `_count.followers` (the UI shows it as "N followers"), but its value now comes from the `followings` count. A comment explains the schema naming.
- Reuse: `BlockService` is already injected in `UsersService`.

**Unit tests** (`users.service.spec.ts`, Prisma mocked)
- `toggleFollow` self 400, unknown target 404, normal follow and unfollow still work.
- `getRecommendations` is called with `orderBy` on `followings`, `notIn` containing followed and blocked IDs, and `banned: false`.

**IT** (`graph.it-spec.ts`)
- T5: self-follow 400 and no row. Unknown user 404. Self-block 400. Block of an unknown user 404.
- T8: users with 3, 2 and 1 followers, plus one user who follows many accounts but has none. Recommendations come in the order 3, 2, 1. Connect shows the real follower count.
- T9: block a top user, the user disappears from recommendations and from every Connect page. A banned user is in neither. Blocking removes follows both ways (regression).

**Curl:** self-follow 200→400; unknown follow 500→404; self-block 200→400; recommendations equal the SQL top 3 by followers received (ties by ID); a blocked user and a banned user do not appear in recommendations or in any Connect page.

### Step 5: visibility, privacy, banned users (T10, S2, S3)

**Changes**
- T10, `posts.service.ts` `findOne`: if `post.isApproved` is false, return it only to the author or to an OWNER or MOD of `post.communityId` (one `communityMember` lookup). Otherwise return `null` (404). `users.service.ts` Likes tab: add `isApproved: true` to the `where`.
- S2, `users.service.ts` `findByUsername`: new `toPublicProfile(user, isSelf)` removes `email`, `emailVerified` and `banned` unless it is the user's own profile. The blocked-profile branch also drops `banned`. The frontend never reads these fields for other users (checked).
- S3: add `BannedUserGuard` directly after `JwtAuthGuard` on: `posts.controller.ts` `create`, `comments.controller.ts` `create`, `messages.controller.ts` (class level), `uploads.controller.ts`, `communities.controller.ts` `create`. `PrismaModule` is global, so no module changes.

**Unit tests:** `users.service.spec.ts`: `findByUsername` hides the three fields for a guest and for another user, and returns them for the user themself, including in the blocked branch.

**IT** (`visibility.it-spec.ts`)
- T10: a member's post in a community is pending. An outsider, a plain member and a guest get 404 from `GET /api/posts/:id`. The author and an owner get 200. The Likes tab of someone who liked it does not list it. After approval, everyone gets 200.
- S2: guest and other user get a profile with no `email`, `emailVerified` or `banned`. The owner gets them.
- S3: a user with `banned=true` and a valid cookie gets 403 on post create, comment create, upload, community create, conversation create and message send. A normal user still gets 201.

**Curl:** pending post as outsider 200→404; Likes tab; guest profile has no `email`; banned user's five writes 201→403.

### Step 6: avatar and cover URLs (N4)

**Changes**
- `src/common/validators/image-ref.ts`: decorator `@IsImageRef()`. It accepts (a) a bare upload file name `^[A-Za-z0-9][A-Za-z0-9._-]{0,120}\.(jpe?g|png|webp|gif)$`, or (b) an `https://` URL whose host is in `ALLOWED_IMAGE_HOSTS`. Max length 300.
- `src/common/allowed-image-hosts.ts`: `['res.cloudinary.com', 'picsum.photos']`, with a comment "keep in sync with `apps/frontend/next.config.ts`".
- Use it on `img` and `cover` in `UpdateUserDto` and `UpdateCommunityDto` (replacing the plain `@IsString`).
- The profile edit form sends the file name returned by `/api/uploads`, so normal use is unchanged. The seeded `humans_v1` users use picsum URLs, which are allowed.

**Unit tests** (`image-ref.spec.ts`, using `class-validator` `validate`)
- Valid: `abc123.jpg`, `a-b_c.PNG`, `https://res.cloudinary.com/x/y.jpg`, `https://picsum.photos/seed/a/200/200`.
- Invalid: `https://evil.example/x.png`, `http://res.cloudinary.com/x.jpg` (not https), `javascript:alert(1)`, `../../etc/passwd`, `a/b.jpg`, a 301-char string.
- A sync test reads `apps/frontend/next.config.ts` and checks that every https host in `ALLOWED_IMAGE_HOSTS` is listed there.

**IT** (`avatar.it-spec.ts`): `PATCH /api/users/me` with the evil URL 400; with `x.jpg` 200; upload then patch with the returned file name 200; same two for `PATCH /api/communities/:id`.

**Curl:** `{"img":"https://evil.example/x.png"}` 200→400; `{"img":"abc.jpg"}` 200. Data check: `select username, img from "User" where img ~ '^https?://' and img !~ '^https://(res.cloudinary.com|picsum.photos)/'` returns 0 rows.

### Step 7: socket auth (S1)

**Changes** (`notifications.gateway.ts`; inject `PrismaService` and `RedisService`, both global)
- `handleConnection`: verify the JWT (already done), **also** check the logout blacklist (`BLACKLIST_PREFIX` + `jti`), then set `socket.data.user = { id, username }` and **join the user's own room on the server**.
- `newUser`: keep the handler (the frontend still sends it), but ignore the client's value. It only re-joins the socket's own room.
- Remove `sendNotification` (the frontend never emits it).
- `joinConversation`: check the id is an integer and that `socket.data.user.id` is a `conversationMember`. If not, do nothing.
- `startTyping` and `stopTyping`: use `socket.data.user.username`, not the client's `username`. Only emit if `socket.rooms` already has `conversation:<id>` (so a non-member cannot emit into the room).
- No frontend change is needed (`Socket.tsx` and `useTypingIndicator.ts` keep working).

**Unit tests** (`notifications.gateway.spec.ts`, Socket stubbed)
- Connect with a good token sets `data.user` and joins the own room. A blacklisted `jti` or no cookie disconnects.
- `newUser('bob')` from alice does not join room `bob`.
- `joinConversation` by a non-member does not join. By a member it joins.
- `startTyping` emits with the real username, even if the payload lies.

**IT** (`socket.it-spec.ts`, real server on an ephemeral port)
- alice sends `newUser: "bob"`. A DM from carol to bob reaches bob, **not** alice.
- A fake `sendNotification` reaches nobody.
- alice joins a conversation she is not in, carol types, alice gets no `userTyping`. A member gets it.
- A logged-out token is disconnected on connect.
- Regression: bob gets `newMessage`, `getNotification` and `accountBanned` with and without sending `newUser`.

**Verify script:** `scripts/verify-socket.cjs` (the Node script from the run, with PASS or FAIL output).

### Step 8: frontend error handling and docs (B4, docs)

**Changes**
- `apps/frontend/src/lib/api.ts`: new `jsonOrThrow(res)` (throws `Error("Request failed: <status>")` when `!res.ok`).
- `InfiniteFeed.tsx` `fetchPosts` uses it. The render becomes `if (!data) return error ? "Something went wrong!" : "Loading..."`, so a failed refetch keeps the posts that are already shown.
- Same one-line change in the other list fetchers that call `res.json()` blindly: `ProfileTabFeed.tsx:129`, `hashtag/[tag]/page.tsx:21`, `UserList.tsx:31`.
- `CLAUDE.md`: seed users are `user1`–`user50` / `password`. Replace "There is no test suite" with the new commands and the need for `docker compose up db redis -d`.
- New `.docs/prethesis-corrections.md` with a section "Code fixes (bug sweep)": one row per ID with the commit and the behavior change. P0 adds its four items later.
- `.docs/Pre-thesis check.md`: add a "Fixed in" note per ID.

**Tests:** the frontend has no test runner and adding one is out of scope. Checks are `npm run typecheck`, `npm run lint`, and the browser check in section 8.

---

## 6. Behavior changes to expect

- Counts are lower after deletes (T1, T2). The Explore score reads them, so BL2 changes only when soft-deleted rows exist. Note it in the corrections file.
- Bad IDs, bad cursors and over-long text return 400 or 404, not 500.
- Pending community posts are 404 for outsiders. Guests no longer see emails.
- `newUser` ignores its argument. Typing events use the server-side username.
- Recommendations and Connect change order, and hide blocked and banned users.

## 7. Risks and costs

- **`main.ts` refactor.** Covered by the 72-route count and the curl script.
- **Extra queries.** `BannedUserGuard` adds one query per guarded write (and per request on messages). Toggles add one existence check. `_count` with `where` adds a filter to the feed query. None is on the thesis hot path, and E7 will measure the feed anyway.
- **New dev dependencies** change `package-lock.json`. The backend Docker image copies all `node_modules`, so it grows by tens of MB. Accepted.
- **ITs share the dev Postgres** but use schema `it_test` and Redis database 1. They never touch the `public` schema.
- **Husky** only type-checks the frontend. Backend tests are run by hand (`npm run test:backend`).

---

## 8. Verification (end to end)

1. **Static:** `npm run typecheck`, `npm run lint`, `npm run build -w @breadit/backend`.
2. **Tests:** `docker compose up db redis -d`, then `npm run test:backend` (unit then IT). All green.
3. **Curl script `scripts/verify-bug-sweep.sh`:**
   - Starts from a running local backend (`BASE_URL`, default `http://localhost:4000`). It creates `t_*` users by register, reads the email code from the database (`docker exec breadit-db-1 psql`), and signs in once per user.
   - The header explains how to start the backend safely: SMTP set to a dead port and Cloudinary blank, so no real email or upload happens.
   - It prints `PASS` or `FAIL` per row (`assert_status name expected actual`) and exits non-zero on any FAIL. About 30 rows: the Curl lines above, plus a "still works" group (feeds, post create, edit and delete, comments, follow, DM, admin ban and unban).
   - **Run it twice:** on the unfixed code first (expect FAIL on the 14 IDs, saved as the "before" record), then after the last commit (expect all PASS).
4. **Socket:** `node scripts/verify-socket.cjs`.
5. **Browser (Chrome):** (a) B4: flood `/api/posts` with 1,300 requests, reload `/`: the layout stays and the page shows "Something went wrong!" with no crash screen. (b) T1 in the UI: repost, undo, reload: count 0 and a grey icon. (c) N4: the profile edit still saves an uploaded avatar. T3 (10-second feed cache) is **not** fixed here, so it is expected to remain.
6. **Page sweep:** the 26 pages return the same status codes as in the verify run.
7. **Clean database:** `docker compose down -v`, then `prisma migrate deploy` and the seed pass, and the 72 routes map.
8. **Docs:** every ID has a row in `prethesis-corrections.md`.

---

## 9. Not in this pass

- **P2 (schema):** T6 duplicates and unique keys (the clean seed has 53, 45 and 3 duplicate pairs, a ready test), a check against self-follow in the database, toggles that survive a unique-key error.
- **P6:** T4 (`asOf`), T3 (cache off in the parity test), `isApproved = true` and a deduped followee list in `buildPool`, B6 (ban clears the community cache).
- **E7:** N6 (per-route rate limit as an env variable) and a note on whether the cache is on.
- **Known limits (listed, not fixed):** S4, S5 (HTTP part), S6, B1, B2, B5, B6, B7–B10, N2, N3, N5, N7–N10, the 66 npm vulnerabilities, unused code and env names.

---

## 10. Result

Done on 2026-10-21. All 14 issues in section 2 are fixed, on the branch `thesis`, one commit per group:
`84e84a7` (setup), `c4d5d46`, `e48a289`, `db5a8f4`, `53fb757`, `91f0aea`, `3b62928`, `5db92b8`. The tag `v1-prethesis` marks `6f7b884`. Nothing was pushed.

**Done-when checks (section 1)**
1. Every fixed ID has a test that failed before and passes after: yes. Each step started with failing tests.
2. The curl script: 42 passed and 53 failed before, **95 passed and 0 failed** after, on a freshly seeded database. Records: `21-10-bugs-sweep-before.txt` and `21-10-bugs-sweep-after.txt`.
3. `npm run typecheck`, `npm run lint` (0 errors, warnings as before) and `npm run build -w @breadit/backend` pass.
4. 72 routes are mapped. `docker compose down -v`, `prisma migrate deploy` and the seed pass on an empty database.
5. Every fix has a row in [../prethesis-corrections.md](../prethesis-corrections.md).

**Tests:** 99 unit tests (8 suites) and 108 integration tests (7 suites), all passing.
**Browser (Chrome):** B4 (a rate-limited feed keeps the page and shows "Something went wrong!"), T1 (repost, undo, reload: count 0, grey icon) and T8 (new suggestions in the right bar) confirmed. The page sweep gave the expected codes on 26 checks. The avatar upload in the profile form was not clicked through in the browser, because the file chooser cannot be driven. The same flow (upload, then save the returned file name) is covered by an integration test.

**Differences from the plan**
- Cursor parsing uses a custom `@Cursor()` decorator, not a pipe. The global `ValidationPipe` converts a `number` query to `NaN` before a pipe runs, so a missing cursor became a 400. An integration test now checks every converted route without a cursor.
- `ProfileTabFeed.tsx` already checked `res.ok`, so only the home feed, the hashtag page and the followers lists changed in B4.
- Extra checks added while fixing T7 and N1: a repost through `rePostId` needs a live original, and editing a post or comment cannot leave it empty.
- New dev dependencies had to be installed with `--legacy-peer-deps` (an old peer conflict between Nest 10 and Nest 11 packages). It is noted in `CLAUDE.md`.
- The verify script and the socket script were written in Step 1, as planned, so the "before" record exists.

