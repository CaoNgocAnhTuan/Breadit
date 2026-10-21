# Bugs Report

2026-10-21 · branch `test-app` · baseline tag `v1-prethesis` (commit `6f7b884`)

All known bugs of the pre-thesis app, in one place: what was **resolved**, what is **still open**, and **which to fix first**. It replaces the two older files `Pre-thesis check.md` and `prethesis-corrections.md`. The run that tested every finding is in [Pre-thesis verify.md](Pre-thesis%20verify.md). The fix plan is [works/21-10-bugs-sweep-pre-thesis.md](works/21-10-bugs-sweep-pre-thesis.md).

How the report was made: first I read the code and listed 26 suspected problems. Then I ran the whole system (curl, Socket.IO scripts, Chrome) and tested them. The run confirmed 25 and half confirmed 1, and found 10 new ones, so the review has **36 findings**. During the fixes I found 6 more small items (R1–R6). IDs: **T** = on the thesis path, **S** = security, **B** = other bugs, **N** = new in the run, **R** = found during the fixes.

---

## 1. Summary

| | Count |
|---|---|
| Findings in the review | 36 (T1–T10, S1–S6, B1–B10, N1–N10) |
| **Resolved** | **14** |
| **Still open** | **22 of the 36, plus 6 found later (R1–R6) = 28** |
| Open decision | 1 (D1) |

Open items by priority: **P1 = 6, P2 = 6, P3 = 8, P4 = 8.** What the levels mean is in section 2.

The fixes were checked like this:
- The same curl script ran on the unfixed code (**42 passed, 53 failed**) and on the final code on a freshly seeded database (**95 passed, 0 failed**). Output: [works/21-10-bugs-sweep-before.txt](works/21-10-bugs-sweep-before.txt) and [works/21-10-bugs-sweep-after.txt](works/21-10-bugs-sweep-after.txt).
- 99 unit tests and 108 integration tests pass. Each fix started with a test that failed.
- In Chrome: B4, T1 and T8 were confirmed in the UI. A sweep of 26 page checks gave the expected status codes.

---

## 2. Priority guide and fix order

| Level | Meaning | When to fix |
|---|---|---|
| **P1** | On the thesis path. It changes thesis results or a thesis phase needs it. | Inside the phase named in the row (P2, P6 or E7 of the super plan). |
| **P2** | Security or data loss. Harmless on one local machine. | **Before** anyone else uses the app: a demo on a shared server, or any deploy. |
| **P3** | A bug that users see: wrong or broken behavior. | When time allows. |
| **P4** | Small wrong behavior, cleanup or performance. | Last. |

Effort guess: **XS** under 30 min, **S** under 2 hours, **M** half a day, **L** over a day.

**Suggested order**
1. **By thesis phase:** T6 in **P2**. Then T4, T3, B6, R2 in **P6** (with the decision D1). Then N6 in **E7**.
2. **Before sharing the app:** S5 (HTTP part), B1, S4, S6, B5, R3.
3. **Quick wins** (each XS or S, about half a day together): B9, B10, B2, R1, N8, B1, S5, N7.
4. The rest of P3 and P4.

---

## 3. Open bugs

Code locations use function and file names, because line numbers moved during the fixes.

### 3.1 P1: thesis path

| ID | Problem and effect | Evidence from the run | How to fix | Effort |
|---|---|---|---|---|
| **T6** | `interactions.service.ts` (like, save) and `users.service.ts` (follow) do "check, then write" and the tables have no unique key. Two fast requests make duplicate rows and wrong counts. Until fixed, `\|F_u\|` in the trust formula counts duplicates twice. | 6 parallel likes made 6 rows. 6 parallel follows made 6 rows, and one unfollow left 5. **The clean seed already has duplicates:** 53 like pairs (54 extra rows), 45 follow pairs (48 extra), 3 saved pairs (3 extra). | **P2 migration** (in the plan): delete duplicates (keep the lowest `id`), add unique keys, add a CHECK against self-follow. The toggles must catch the unique-key error. The seed is a ready test for the migration. | M |
| **T4** | Explore uses `Date.now()` for the 7-day window and for age (`posts.service.ts`, Explore branch). The same request gives a different order later, so it cannot be replayed at a past time. | The same Explore page 1 gave `nextCursor` `699:557`, and about ten minutes later `696:557`. | **P6** (in the plan): move the score into `ranking/core` and pass `asOf` as an argument. | M |
| **T3** | The feed cache lives 10 s and is keyed by the `v:user` counter. Creating or deleting a post, like, repost and comment never change that counter, so a new post can be missing from the feed for up to 10 s. | bob's feed was empty. After he posted, the same call still returned 0 posts, while the profile feed showed it. 11 s later it was there. In Chrome the compose box cleared but the post did not show. With the cache off it showed at once. | Bump `v:user` of the author on create and delete (and on interactions), or skip the cache for the viewer's own feed. **P6/E7:** run the parity test with `REDIS_HTTP_CACHE_ENABLED=false`, and say in E7 whether the cache is on. | S |
| **N6** | The rate limit (1,000 per minute, `app.module.ts`) is counted **per route** per IP and is hard-coded. The Next server calls from one IP, so all its users share each counter. It is the likely cause of the 71% failures in the old k6 file (not proven: that file stores no status codes). | After 1,300 calls to `/api/posts`, that route gave 429, while `/api/search`, `/api/hashtags/trending` and `/api/communities` gave 200. | **E7** (in the plan): make the limit an env variable. A k6 run counts only if `http_req_failed` is 0. | S |
| **B6** | A community ban does not clear the banned member's cached community list (5 min). The thesis feed will reuse `getCommunityIds`. | In `club-two`, dave's Communities feed showed post 905. The mod banned dave. 11 s later the feed still showed it. | In `banUser`: delete `graph:communities` for the target and bump `v:user`. Do the same for all members when a community is deleted. | S |
| **R2** | Pending community posts (not yet approved) can still be liked, saved, reposted and commented on by ID, and their comments can be read. The post itself is hidden since the fix for T10. | The like was accepted: a pending post showed in the Likes tab before the T10 fix. The comment parts are from code. | `assertPostLive` also hides unapproved posts from non-staff. **P6:** `buildPool` must require `isApproved = true` when community posts enter the candidate pool. | S |

### 3.2 P2: before anyone else uses the app

| ID | Problem and effect | Evidence from the run | How to fix | Effort |
|---|---|---|---|---|
| **S5** (HTTP part) | `optional-jwt.guard.ts` does not check the logout blacklist. A logged-out cookie still gets personal data on public routes. (The socket part is fixed.) | After logout, `/me` and like gave 401, but `GET /api/posts/1` still returned `likes:[{id:2001}]`. A guest gets nothing. | Use the same blacklist check as `JwtAuthGuard`. Put it in one shared function. | S |
| **B1** | `moderatePost` removes the post for any `action` other than `'APPROVE'`. The `promote` role is not checked. A typo in a request deletes a post. | `{"action":"APROVE"}` returned 201 and the post was soft-deleted. `{}` did too. Promote with `role:"ADMIN"` gave 500. | DTOs with `@IsIn(['APPROVE','REMOVE'])` and `@IsEnum(CommunityRole)`. | XS |
| **S4** | On local disk, non-image uploads keep the user's file extension and are served from the API origin (`uploads.service.ts`). A verified user can host an `.html` file there. Not a problem with Cloudinary. | `evil.html` uploaded as `video/mp4` was saved as `<uuid>.html` and served as `text/html` (HTTP 200). | Allow only known image and video types, take the extension from the type, and send `X-Content-Type-Options: nosniff` on `/uploads/`. | S |
| **S6** | Fallback secret `dev-secret-change-in-prod`. The email code uses `Math.random`. Code tries are limited only per IP (10 per minute). A password reset does not end old sessions. | After a password reset, the older session cookie still worked (`/me` 200). The other parts are from code only. | Refuse to start without `JWT_SECRET` in production. Use `crypto.randomInt`. Count tries per email. Keep `passwordChangedAt` and reject older tokens. | M |
| **B5** | The "verify your email" banner links to `/verify` with no email, which shows "No email provided". The login token keeps `emailVerified: null` until the next login, while `/api/auth/me` reads the database. | After verifying, the old cookie got `/me` "verified" but `POST /api/posts` gave 403. A new login gave 201. In the UI, unverified `t_frank` saw the banner link to a page that says "No email provided". | Link to `/verify?email=…`. Let `EmailVerifiedGuard` read the database (like `BannedUserGuard`) or issue a new cookie after verifying. | S–M |
| **R3** | Dependencies. `npm ci` reports **66 vulnerabilities (6 low, 18 moderate, 39 high, 3 critical)**. `nestjs-throttler-storage-redis` is deprecated. I did not check which packages or whether they matter. | From the `npm ci` output. | Run `npm audit`, update what is safe, and decide on the throttler storage package. | M–L |

### 3.3 P3: bugs that users see

| ID | Problem and effect | Evidence from the run | How to fix | Effort |
|---|---|---|---|---|
| **N2** | `findByPost` in `comments.service.ts` has no block filter. A blocked user's comment is still shown to the person who blocked them. | carol blocked dave. On bob's post, carol still saw dave's comment. | Filter by `blockService.getAllBlockedPeerIds`, replies included. | S |
| **N3** | `findOrCreateConversation` checks, then creates, with no unique pair. Parallel requests make duplicate threads. | 5 parallel creates made 5 conversations. DM search returned the same person 4 times. | A unique pair key with an upsert (fits the P2 migration), or a lock. | M |
| **N5** | `Post.tsx` wraps the post text in a link to the status page, and `RichText.tsx` puts a link for each `@mention` inside it: `<a>` inside `<a>`. React logs a hydration error and rebuilds the tree on the client. | Chrome console: "In HTML, `<a>` cannot be a descendant of `<a>`" and "Hydration failed…", on a post with mentions. | Do not wrap the text in a link. Make the card clickable another way. | S |
| **B2** | The community slug has no format rule. Spaces, `/` or capitals break `/c/<slug>` links. | Slug `Has Space/And Slash` was created (201). | `@Matches(/^[a-z0-9-]{3,30}$/)` in the DTO. | XS |
| **B7** | `getTrending` counts tags of community posts (and, from code, deleted posts) and is not cached. Trending numbers are wrong. | Reported vs real: music 38 vs 16, photography 36 vs 12, books 36 vs 13, productivity 133 vs 113, coffee 82 vs 62. | Count only live root posts outside communities (a join or a raw query). Cache it for a minute. | S–M |
| **N8** | Opening or refreshing `/compose/post` directly gives 404. It only works as an in-app modal. | `GET /compose/post` with a session cookie gave 404. | Add a page or a `default` for the children slot. | XS–S |
| **R1** | `_count.replies` on comments also counts deleted replies, the same bug as T1. The UI only uses it at the nesting limit. | Found while fixing T1 (code). | Use a filtered count in `commentInclude`. | XS |
| **R6** | An admin can ban themselves or other admins (`setBanStatus`). A ban does not end the token, but `BannedUserGuard` now blocks writes. | The admin banned their own account (200), kept working, and unbanned it. Banning another admin was not run. | Refuse self and admin targets with 400. | S |

### 3.4 P4: minor

| ID | Problem and effect | Evidence from the run | How to fix | Effort |
|---|---|---|---|---|
| **B8** | A comment like is sent as `LIKE` with the post ID, so the text says "liked your post". `Notification.commentId` is never filled. | New `LIKE` rows had `postId` set and no `commentId`. | Fill `commentId` and use text "liked your comment". | S |
| **B9** | The "Explore" menu item links to `/`, not `/?feed=explore` (`LeftBar.tsx`). | In the page HTML, Explore, Homepage and More all link to `/`. | Change the `href`. | XS |
| **B10** | `GET messages` sets `lastReadAt` but does not clear the `dm:unreadCount` cache (60 s). | After `GET messages` the list showed `unread:2` while `unread-count` said 1. | Delete the cache key in `getMessages`. | XS |
| **N7** | Small API mistakes: an unknown profile name returns 200 with an empty list, `%` in search works as a wildcard, and an empty search returns no `communities` key. | `GET /api/users/user1_nope/posts` gave 200. `q=%` returned 5 posts. `q=` returned only `hashtags`, `posts`, `users`. | Return 404, escape `%` and `_`, keep one response shape. | S |
| **N9** | Every new follow row sends a notification, so follow, unfollow, follow again repeats it. | bob had 8 FOLLOW notifications from 3 people (6 from alice's parallel requests). | Skip the notification if one from the same actor already exists. Easier after P2. | S |
| **N10** | One user can report the same post many times, and each report notifies every admin. | carol's two reports on one post made 2 rows and 2 notifications. | Unique key on (reporter, post) with an upsert (fits the P2 migration). | S |
| **R4** | Dead code and unused config: the `Account` and `Session` models, `Post.parentPostId` and its relation (queries still filter `parentPostId: null`), the `resend` npm package, the env names `STORAGE_DRIVER`, `RESEND_API_KEY` and `EMAIL_FROM`, and frontend lint warnings (unused variables in six components). | From code and `npm run lint` (warnings only, 0 errors). | Remove them. The schema parts belong in the P2 migration. | S–M |
| **R5** | `getConnectUsers` builds the whole user list in memory and slices it. Fine now, slow at 5,000 users. | Code only. The connect list had 9 pages for 107 users. | Page in the database. | M |

---

## 4. Open decision

**D1. Can a non-member post into a community?** Today anyone can submit a post to any community and it goes to the approval queue (`PostsService.create`). The community term in the hybrid score assumes that "member" means something. **I recommend requiring membership.** It changes product behavior, so it is your call. Decide before the generator (P3) and the hybrid scorer (P6).

---

## 5. Resolved bugs

The 14 findings below are fixed on `test-app`. "Where" is the code at the tag `v1-prethesis`. Details of each test are in [Pre-thesis verify.md](Pre-thesis%20verify.md).

### 5.1 Thesis path

| ID | Problem (where) | Evidence before the fix | Fix | Commit |
|---|---|---|---|---|
| **T1** | Repost count and the "I reposted" flag counted soft-deleted reposts (`posts.service.ts`, and the same include in `users`, `search` and `hashtags` services). The Explore score reads the count. | After un-repost, the API said `count:0` but the post still showed `_count.rePosts:1` and my flag. In Chrome, after "Undo Repost" and a reload, it showed `1` and a green icon. | One `engagementSelect()` (`posts/engagement.ts`) counts only live reposts and is used by posts, profile tabs, search and hashtag pages. After the fix: count 0 and a grey icon (checked in Chrome). | `e48a289` |
| **T2** | The comment count included deleted comments. | A comment and a reply gave 2. After deleting the reply it stayed 2 while the thread showed 1. | The same helper counts non-deleted comments (replies included). | `e48a289` |
| **T5** | Self-follow and self-block were allowed. An unknown user ID gave 500 (`users.service.ts`). | alice following herself returned `following:true` and made 1 row. Self-block returned `blocked:true`. | 400 for yourself, 404 for an unknown user. The block and the follow clean-up run in one transaction. | `db5a8f4` |
| **T7** | Missing or deleted posts and comments were not checked. Bad IDs and cursors gave 500. | Missing post 99999999: like, save, repost, report gave 500. `/api/posts/abc` gave 500. On a deleted post: like, save, repost 200 and comment 201. Bad `cursor` on notifications, admin users, profile posts, hashtag pages: 500. Unknown user in follow, block or DM: 500. | `ParseIntPipe` on IDs and a `@Cursor()` decorator (400). Existence checks (404). Prisma errors map to 404, 409 or 400 in `AllExceptionsFilter`. | `c4d5d46` |
| **T8** | "Most popular" users were sorted by `_count.followers`, which in this schema means "accounts this user follows" (`users.service.ts`). | Recommendations: user32, user3, user48. The most followed: user16, user40, user31. | Rank by followers received, with `id` as tie-break. Connect keeps the field `_count.followers` that the UI reads, now with the real number. Chrome now shows User 16, 31, 40. | `db5a8f4` |
| **T9** | Recommendations and Connect showed blocked and banned users. | After carol blocked user32, it was still in recommendations and on the connect list (9 pages, 107 users). A banned user was in connect. | Exclude yourself, people you follow, blocked peers (both directions) and banned accounts. | `db5a8f4` |
| **T10** | A pending community post could be opened by URL and showed in the Likes tab (`findOne`, `getPostsByTab`). | A user outside the community got post 901. A pending post liked by `t_cat` showed in her public Likes tab. | Visible only to the author and the community owner or mods (404 for everyone else). The Likes tab skips pending posts. | `53fb757` |

### 5.2 Security

| ID | Problem (where) | Evidence before the fix | Fix | Commit |
|---|---|---|---|---|
| **S1** | `newUser` joined any room by a username the client sent. `sendNotification` faked notifications. `joinConversation` had no member check (`notifications.gateway.ts`). | alice sent `newUser: "t_bob"` and received bob's private DM. Her fake notification reached carol. A non-member got typing events. | The server checks the login cookie before the socket connects, joins it to its own room, and ignores the username the client sends. `joinConversation` is for members only. Typing events use the real username. `sendNotification` is removed. | `3b62928` |
| **S2** | `GET /api/users/:username` returned the whole user row except the password, to anyone (`findByUsername`). | With no cookie it returned email, `emailVerified`, `role` and `banned` of bob. | `email`, `emailVerified` and `banned` are removed for everyone except the owner. | `53fb757` |
| **S3** | No `BannedUserGuard` on several writes. | Banned `t_eve` with her old cookie: post, comment, upload, new DM and create community all gave 201. Like, follow, report, delete gave 403. | The guard is added to post create, comment create, uploads, community create and all DM routes. A unit test keeps it there. (Admins banning themselves is still open: R6.) | `53fb757` |

### 5.3 Other bugs

| ID | Problem (where) | Evidence before the fix | Fix | Commit |
|---|---|---|---|---|
| **N1** | A post with no text and no media, and an empty comment, were accepted. | Post 885 and comment 754 were created empty. | 400 "must have text or media". An image-only post and a plain repost still work. Editing cannot empty them. | `c4d5d46` |
| **N4** | Any text was accepted as an avatar or cover (`update-user.dto.ts`). `next/image` throws for unknown hosts, so pages returned 500. | With `img = https://evil.example/x.png`, every page was 500 for that user. For another user, her profile and **their notifications page** were 500. | `@IsImageRef()`: an uploaded file name, or `https` on `res.cloudinary.com` or `picsum.photos`. Used for users and communities. A unit test checks the hosts match `next.config.ts`. | `91f0aea` |
| **B3** | Text over the column size gave 500 (post 255, comment 1,000). | A 300-char post, 400-char quote repost and 1,200-char comment gave 500. A report with no reason gave 500. | Limits checked (counted in characters, so an emoji is 1) and answered with 400. The report needs a reason. | `c4d5d46` |
| **B4** | The feed fetch never checked `res.ok` (`InfiniteFeed.tsx`). | After 1,300 requests, `/api/posts` gave 429 and the home page showed the crash screen "Something went wrong. Try again". | `jsonOrThrow()` in the home feed, the hashtag page and the followers lists. A failed refetch keeps the posts already shown. Chrome now keeps the page and shows "Something went wrong!" in the feed area. | `5db92b8` |

### 5.4 What the fixes mean for the thesis baseline

- The thesis baselines BL0 to BL5 are computed from events by the harness. The fixes change the **live** counts only when deleted rows exist, and the synthetic generator writes none. So the harness results do not change.
- The Explore numbers in the old pre-thesis report were measured with the buggy counts and the old rate limit. They are not comparable with new runs (see section 7).
- The setup commit `84e84a7` added the Jest tests, `app.setup.ts` and the two verify scripts (`scripts/verify-bug-sweep.sh`, `scripts/verify-socket.cjs`). No behavior change.

---

## 6. Where each open bug is handled

| Phase | Bugs |
|---|---|
| **P2** (schema) | T6, and with the same migration: N3, N10, R4 (schema part) |
| **P6** (hybrid scorer) | T4, T3, B6, R2, and the decision D1 |
| **E7** (cost run) | N6, and T3 (say if the cache is on) |
| **Before sharing the app** | S5, B1, S4, S6, B5, R3, R6 |
| **No phase, when time allows** | the rest of P3 and P4 |

---

## 7. Documentation and text corrections

**Done.** `CLAUDE.md`: the seed makes `user1` to `user50` (it said `user1` to `user5`). The test commands, the verify scripts and the `--legacy-peer-deps` note are added, and "There is no test suite" is removed. New dev dependencies must be installed with `npm install --legacy-peer-deps`, because `@nestjs/core` 10 and `@nestjs/websockets` 11 conflict (this was already so before the sweep).

**Still to write in P0** (pre-thesis text, only listed here):
1. The LightFM sentence (`Latex/chapters/conclusion.tex:88`, `docs/chapter7_conclusion.md:64`).
2. The abstract numbers that do not match chapter 5.
3. The k6 failure explanation. New evidence (N6): the rate limit is per route, so a k6 run on one Explore route fails fast under the old limit of 120 per minute.
4. The NFR doc that still says 120 per minute.

**Also found, for the same list:**
- `README.md` says `npm run dev:reset` for local work. It runs `db push --force-reset`, which wipes the database and skips the migrations.
- `README.md` calls Explore "trending by likes". The code uses the weighted score.
- `docs/testcase.md` says verify returns a session cookie. The code only returns `ok`, and the user must sign in.
- `docs/feed_implementation_now.md` says page size 3. The code uses 10.

---

## Appendix A. What was built (system inventory)

This is the state of the app that the bugs above were found in.

### A.1 Backend

13 controllers, **72 REST routes**, one Socket.IO gateway. All routes are under `/api/...`. Guards are per route: login, email verified, not banned, admin role.

| Module | What it does | Routes |
|---|---|---|
| auth | Register, email code (OTP) verify and resend, login, logout, `me`, forgot and reset password. Sensitive routes are limited to 5–10 per minute. | 8 |
| posts | Feeds, one post, create with up to 10 images or videos, edit, soft delete, report. | 6 |
| interactions | Like, save, repost and quote-repost. Each one is a toggle. | 3 |
| comments | Threaded comments (5 levels), media, edit, soft delete, like, sort by relevant, top or recent. | 5 |
| users | Profile, profile tabs (posts, replies, media, likes), followers and following, follow, block, saved posts, edit profile, recommendations, "connect" list. | 12 |
| communities | Create, list and search, join and leave, edit, images, rules, ban and unban, promote, transfer owner, delete, post approval queue. | 16 |
| messages | 1-to-1 DMs, unread counts, search, read receipts. | 8 |
| notifications | List, mark one or all as read. Also pushed live over the socket. | 3 |
| search | One call: top 5 users, posts, hashtags and communities. | 1 |
| hashtags | Top 5 trending tags, posts by tag. | 2 |
| admin | User list, ban and unban, report list, dismiss a report, delete a reported post. | 6 |
| uploads | One file upload. | 1 |
| health | Status and cache hit counts. | 1 |

Four support modules have no routes: `block`, `cache` (Redis JSON and version counters), `redis` and `prisma`.

**Feeds** (`GET /api/posts`, page size 10):
- **For You** (no `feed` param): posts from you and your followees, newest first. No community posts.
- **Explore**: posts from the last 7 days (the newest 400 are scored). Score = likes + 2·comments + 3·reposts − 0.25·age in hours. At most 3 posts per author in the candidate list.
- **Following** and **Communities**: followees only, or approved posts from your communities.
- **Profile** (`user=<id>`) and **community** (`communityId=`): one author, or one community.
- Cursors: time-ordered feeds use `"{createdAtMs}:{id}"`, Explore uses `"{score}:{id}"`, and old page numbers still work. A bad `feed` or `communityId` is ignored and the first page is returned.

**Other behavior** (all seen in the run):
- **Delete rules.** Posts and comments are soft-deleted (`deletedAt`). Likes, saves, follows, blocks and community membership are hard-deleted.
- **Blocking.** Feed, Explore, search, DMs, profile views and direct post links hide blocked peers. Blocking removes follows in both directions. Comments (N2) are the gap.
- **Community posts.** A post from a regular member starts with `isApproved=false` and stays out of the community feed until an owner or mod approves it.
- **Notifications.** 8 types are sent: like, reply, repost, follow, mention (post and comment), community post, community new post, report. `COMMUNITY_MOD_ADDED` exists but is never sent.
- **Uploads.** With Cloudinary set, files go there. Otherwise images are re-encoded with sharp (JPEG, width 600) onto local disk and videos are stored as they are. Limit: 10 files, 500 MB each.
- **Email.** Sent over SMTP. If SMTP is not set, register still works (201) and the code is not sent. In local work, read the code from the `VerificationToken` table, or use seed users, who are already verified.
- **Rate limit.** 1,000 per minute per route per IP. Login and register stop at 10 per minute.
- **Real-time.** Client to server: `newUser`, `joinConversation`, `leaveConversation`, `startTyping`, `stopTyping`. Server to client: `getNotification`, `newMessage`, `messageRead`, `accountBanned`, `userTyping`, `userStopTyping`.

**Cache** (Redis): `feed`, `search`, `notifications` 10 s. `graph:follows` and `graph:communities` 5 min. `graph:blockedPeers` and `dm:unreadCount` 60 s. `v:user` version counters never expire. `REDIS_HTTP_CACHE_ENABLED=false` turns the JSON cache off.

### A.2 Frontend

28 pages and 45 components (about 10,000 lines).
- **Auth pages:** sign-in, sign-up, verify, forgot password, reset.
- **Main app (`(board)`):** home with four tabs (For you, Explore, Following, Communities), compose modal, profile with followers and following pages, post page with comments, bookmarks, "connect" list, search, hashtag page, notifications, messages, communities (list, create, view, about and admin), settings (blocked accounts).
- **Admin console:** user table (ban and unban) and report table (dismiss or delete post). Non-admins are redirected.
- **Other parts:** left bar, right bar, a Socket.IO singleton, three DM surfaces (page, popup, drawer).
- **Routes with no UI.** Four community routes are never called by the frontend: edit name and description, promote a member, transfer ownership, delete a rule. They work with curl.

### A.3 Data and tooling

- **Database:** 25 models, 18 migrations. The code is about 6,100 lines (backend).
- **Seed** (`prisma/seed.ts`): `admin` / `123456` and 50 users `user1`–`user50` / `password`. A clean run creates 500 posts, 488 follow rows, 2,000 likes, 500 saves, 81 reposts and 750 comments. Two runs gave the same totals.
- **`humans_v1`:** two data migrations add 50 demo users `human01`–`human50` (no password, so they cannot log in) with communities and posts. They have 0 follows and 0 likes. Their tags (for example `productivity`, 133) dominate the trending top 5.
- **Docker:** `db` (Postgres 16, port 5433) and `redis` (port 6378) ran from the compose file. The `backend` and `app` images were not built in the run.
- **Git hook:** pre-commit runs ESLint on the frontend and `tsc --noEmit`. It does not run the backend tests.
- **Environment:** no `.nvmrc`. Local Node is v22.14.0 and the Docker image is `node:20-alpine`. `.env` has real SMTP and Cloudinary values and `STORAGE_DRIVER=cloudinary`, which the code never reads. Sign-in works in Chrome with the `Domain=localhost` cookie.

---

## Appendix B. How complete is this report

- **Read in full:** every backend controller and service, the Prisma schema, the seed, the Docker files, `Makefile`, the env examples, the frontend fetch layer, middleware, layouts, the home and feed components, the post card, compose box, post interactions, profile page, notifications, community page and the admin layout.
- **Mapped by search only:** the other frontend components (chat popup and drawer, comments UI, image editor, community admin UI, admin tables). Every `/api/...` path in the frontend (59 patterns) exists in the backend.
- **Run:** hundreds of curl requests over all 13 modules, two Socket.IO scripts, a Chrome session and a sweep of 26 pages. A second, short run on a clean database rechecked the seed duplicates, MENTION notifications, the Likes tab, admin self-ban and the logged-out socket.
- **Not run:** real email and Cloudinary (off on purpose), the chat and image-editor UI, infinite scroll, the avatar upload through the browser file chooser (an integration test covers it), `next build`, the Docker image builds, load tests, mobile layout, expired codes and expired tokens. Parts that are code only are marked in the Evidence cells.
