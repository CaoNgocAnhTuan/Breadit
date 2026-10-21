# Pre-thesis check

2026-10-21 · branch `test-app` · commit `9606923` (code is the same as `6f7b884`, the end of pre-thesis)

This report says what the pre-thesis code does and what is wrong in it. It was written in two steps. First I read the code and listed 26 suspected problems. Then I ran the whole system and tested them. Each finding below now has an **Evidence** cell from that run. The run itself (setup, safety, list of working features) is in [Pre-thesis verify.md](Pre-thesis%20verify.md). Nothing in the application code was changed.

---

## 1. Summary

Breadit is a complete X-style app. The backend has 13 controllers, 72 REST routes and one Socket.IO gateway. The frontend has 28 pages and 45 components. The database has 25 models and 18 migrations. The code is about 6,100 lines (backend) and 10,000 lines (frontend).

There is no automated test and no CI. The run shows that the code does build and work: backend build, frontend typecheck, all 18 migrations on an empty database, the seed, all 72 routes, and all 26 pages pass. The problems are in the edges.

Result of the review: **36 findings.** 25 of the 26 from reading are confirmed, 1 (S6) is half confirmed, and the run added 10 new ones (N1–N10).

Four points matter for the thesis:

- The "For You" and Explore feeds work by design, but the repost and comment counts they read are wrong after deletes (T1, T2). The feed cache can hide a new post for 10 seconds (T3).
- The follow graph, which the hybrid score will read, has no guard against self-follow, unknown IDs or duplicate rows (T5, T6, T7). The clean seed already has 53 duplicate like pairs and 45 duplicate follow pairs.
- Lists that should hide blocked people do not (T9, N2), and one bad avatar URL can break other people's pages (N4).
- There are real security holes (S1–S5). They do not block the thesis. Most important: any logged-in user can read another user's live DMs (S1), and every user's email is public (S2).

---

## 2. What is built

### Backend

All routes are under `/api/...`. Guards are per route: login, email verified, not banned, admin role. The run mapped exactly 72 routes.

| Module | What it does | Routes |
|---|---|---|
| auth | Register, email code (OTP) verify and resend, login, logout, `me`, forgot and reset password. Sensitive routes are limited to 5–10 per minute. | 8 |
| posts | Feeds (see below), one post, create with up to 10 images or videos, edit, soft delete, report. | 6 |
| interactions | Like, save, repost and quote-repost. Each one is a toggle. | 3 |
| comments | Threaded comments (5 levels), media, edit, soft delete, like, sort by relevant, top or recent. | 5 |
| users | Profile, profile tabs (posts, replies, media, likes), followers and following lists, follow, block, saved posts, edit profile, recommendations, "connect" list. | 12 |
| communities | Create, list and search, join and leave, edit, images, rules, ban and unban, promote, transfer owner, delete, post approval queue. | 16 |
| messages | 1-to-1 DMs, unread counts, search, read receipts. | 8 |
| notifications | List, mark one or all as read. Also pushed live over the socket. | 3 |
| search | One call: top 5 users, posts, hashtags and communities. | 1 |
| hashtags | Top 5 trending tags, posts by tag. | 2 |
| admin | User list, ban and unban, report list, dismiss a report, delete a reported post. | 6 |
| uploads | One file upload. | 1 |
| health | Status and cache hit counts. | 1 |

Four support modules have no routes: `block` (block rules), `cache` (Redis JSON and version counters), `redis` and `prisma`.

How the feeds work (`GET /api/posts`, page size 10):

- **For You** (no `feed` param): posts from you and your followees, newest first. No community posts.
- **Explore**: posts from the last 7 days (newest 400 are scored). Score = likes + 2·comments + 3·reposts − 0.25·age in hours. At most 3 posts per author in the candidate list. In the run, 4 pages showed 7–10 authors each and no duplicates.
- **Following** and **Communities**: followees only, or approved posts from your communities.
- **Profile** (`user=<id>`) and **community** (`communityId=`): one author, or one community.
- Cursors: time-ordered feeds use `"{createdAtMs}:{id}"`. Explore uses `"{score}:{id}"`. Old page numbers (2, 3, …) still work. A bad `cursor`, `feed` or `communityId` is ignored without an error and the first page is returned.

Other behavior worth knowing (all seen in the run):

- **Delete rules.** Posts and comments are soft-deleted (`deletedAt`). Likes, saves, follows, blocks and community membership are hard-deleted.
- **Blocking.** Feed, Explore, search, DMs, profile views and direct post links hide blocked peers. Blocking also removes follows in both directions. Comments and the lists in T9 are the gaps.
- **Community posts.** A post from a regular member starts as `isApproved=false`. It stays out of the community feed until an owner or mod approves it.
- **Notifications.** All 8 types in use were seen: like, reply, repost, follow, mention (post and comment), community post, community new post, report. `COMMUNITY_MOD_ADDED` exists but is never sent.
- **Uploads.** With Cloudinary set, files go there. Otherwise images are re-encoded with sharp (a PNG came back as `image/jpeg`, width 600) onto local disk, and videos are stored as they are. 11 files gave 400 "Too many files (max 10)". Limit: 500 MB each.
- **Email.** Sent over SMTP. If SMTP is not set, register still works (201) and the code is not sent (the error is only logged). In local work, read the code from the `VerificationToken` table, or use seed users, who are already verified.
- **Rate limit.** 1,000 requests per minute per route per IP (`app.module.ts:28`). It is counted per route, not for the whole API (N6). Login and register stop at 10 per minute.
- **Real-time.** Client to server: `newUser`, `sendNotification`, `joinConversation`, `leaveConversation`, `startTyping`, `stopTyping`. Server to client: `getNotification`, `newMessage`, `messageRead`, `accountBanned`, `userTyping`, `userStopTyping`. The run used `newUser`, `sendNotification`, `joinConversation`, `startTyping`, `getNotification`, `newMessage`, `userTyping` and `accountBanned`. It did not use `stopTyping`, `leaveConversation`, `messageRead` or `userStopTyping`.

Cache keys and lifetime:

- `feed`, `search`, `notifications`: 10 seconds.
- `graph:follows` and `graph:communities`: 5 minutes. `graph:blockedPeers` and `dm:unreadCount`: 60 seconds.
- `v:user` version counters never expire.
- `REDIS_HTTP_CACHE_ENABLED=false` turns off the JSON cache. With it off, T3 disappears (checked).

### Frontend

- **Auth pages:** sign-in, sign-up, verify, forgot password, reset.
- **Main app (`(board)`):** home with four tabs (For you, Explore, Following, Communities); compose modal; profile with followers and following pages; post page with comments; bookmarks; "connect" people list; search; hashtag page; notifications; messages; communities (list, create, view, about and admin); settings (blocked accounts).
- **Admin console:** user table (ban and unban) and report table (dismiss or delete post). The layout redirects non-admins.
- **Other parts:** the left bar, right bar, a Socket.IO singleton, and three DM surfaces (full page, popup, drawer). Server components call the backend with `serverFetch`. Client components use `api()` or `fetch` with cookies.
- **Backend routes with no UI.** Four community routes are never called by the frontend: edit name and description (`PATCH /api/communities/:id`), promote a member, transfer ownership, and delete a rule. They work when called with curl (200, 201, 201, 200). The UI can add a rule, change images, ban and unban, approve posts and delete the community.

### Data and tooling

- **Seed** (`prisma/seed.ts`): `admin` / `123456`, then 50 users `user1`–`user50` / `password`. A clean run created 500 posts, 488 follow rows (500 tried, self-follows skipped), 2,000 likes, 500 saves, 81 reposts, and 750 comments (500 comments and 250 replies; the first new comment in the run got id 751). Two separate runs gave the same totals. Sizes can be changed with `SEED_*` variables.
- **`humans_v1`:** two data migrations add 50 demo users `human01`–`human50` (no password, so they cannot log in) with communities and posts. They have 0 follows and 0 likes. Their trending tags (for example `productivity`, 133) dominate the top 5.
- **Docker:** `db` (Postgres 16, port 5433) and `redis` (port 6378) ran from the compose file. The `backend` and `app` images were not built in the run.
- **Git hook:** pre-commit runs ESLint on the frontend and `tsc --noEmit`. The backend has no lint config.

---

## 3. State of the repo

- **No tests, no CI.** No `*.spec.ts` or `*.test.*` file, no `.github`.
- **Environment.** No `.nvmrc`. Local Node is v22.14.0, the Docker image is `node:20-alpine`; the run used Node 22 without problems. `.env` has real SMTP and Cloudinary values, and `STORAGE_DRIVER=cloudinary`, which the code never reads.
- **Install and build.** `npm ci` installs 785 packages in about 2 minutes and reports **66 vulnerabilities (6 low, 18 moderate, 39 high, 3 critical)**. I did not check which packages or whether they matter. `nestjs-throttler-storage-redis` is marked deprecated. Shared build, backend build (`nest build`) and frontend `tsc --noEmit` pass. `npm run lint` passes with warnings only (unused variables in six components and one `<img>` in `MediaViewer.tsx`).
- **Database.** All 18 migrations apply on an empty database, and the seed runs.
- **Browser.** Sign-in works in Chrome. The cookie with `Domain=localhost` is accepted.
- **Git.** 22 commits, no tags. `npm ci` ran the husky install and set the local `core.hooksPath` to `.husky/_`. The super plan P0 handles tags.

---

## 4. Findings

"Where" points to the code. In the Evidence cell, **Confirmed** means I reproduced it. Parts that are still from reading only are marked "code only". More detail on each test is in the verify doc.

### 4.1 On the thesis path (feed, counts, graph)

| ID | Where | Problem and effect | Evidence |
|---|---|---|---|
| T1 | `posts.service.ts:100-102`; same include in `users.service.ts`, `search.service.ts`, `hashtags.service.ts` | `_count.rePosts` and the "I reposted" flag also count soft-deleted reposts. Un-repost only sets `deletedAt` (`interactions.service.ts:69`). After an un-repost, a reload shows the old count and a green icon. The next click makes a second repost. The Explore score reads this count (`:283`). | **Confirmed (API and UI).** API: un-repost returned `count:0`, but `GET /api/posts/887` showed `_count.rePosts:1` and `rePosts:[{id:888}]`. The next toggle left 1 live and 2 total rows. UI: carol's post 926 after "Undo Repost" and a reload still showed `1` with a green icon. The database held only the soft-deleted repost (id 929). |
| T2 | `posts.service.ts:100` | `_count.comments` counts every Comment row of the post: deleted ones and nested replies. The comment number and the Explore score are too high after deletes. | **Confirmed (API).** Post 893: a comment and a reply gave `comments:2`. After deleting the reply the count stayed 2, while the thread showed 1 comment and 0 replies. |
| T3 | `posts.service.ts:139-153`, `Share.tsx:57` | The feed cache (10 s) is keyed by the `v:user` counter. Creating or deleting a post, like, repost and comment never change that counter. After posting, the refetch can return the cached page without the new post for up to 10 s. | **Confirmed (API and UI).** bob's feed was empty. After he posted #883, the same feed call still returned 0 posts, while the profile feed (another cache key) showed it. 11 s later it was there. With the cache off, a new post showed at once. UI: the compose box cleared, but "UI cache probe ZZ1" was not in the feed. It appeared after a reload 11 s later. |
| T4 | `posts.service.ts:263,276` | Explore uses `Date.now()` for the 7-day window and for age. The same request gives a different order later. Already in the super plan, section 3. | **Confirmed.** The same Explore page 1 gave `nextCursor` `699:557`, and about ten minutes later `696:557`. The scores move with the clock. |
| T5 | `users.service.ts:287-312` | `toggleFollow` does not stop self-follow and does not check that the target exists. A self-edge can enter the follow graph that the hybrid score reads. | **Confirmed.** alice following herself returned `following:true` and made 1 row. Self-block returned `blocked:true`. Follow or block of an unknown ID gave 500. |
| T6 | `interactions.service.ts:13-25`, `users.service.ts:287` | Like, save and follow are "check, then write", with no unique key. Two fast requests make duplicate rows and wrong counts. Already planned in P2. | **Confirmed.** 6 parallel likes made 6 rows. 6 parallel follows made 6 rows, and one unfollow (`following:false`) left 5. **The clean seed already has duplicates:** 53 like pairs (54 extra rows), 45 follow pairs (48 extra rows), 3 saved pairs (3 extra rows). |
| T7 | `interactions.service.ts:21`, `comments.service.ts:100-104`, `posts.controller.ts:72` | Missing or deleted targets are not handled. Events on deleted posts pollute the data. Status codes are wrong. | **Confirmed.** Missing post 99999999: like, save, repost and report all gave 500. `/api/posts/abc` gave 500. On a soft-deleted post: like 200, save 200, repost 200 (it made a repost), comment 201. A like on a deleted comment gave 200. The same 500 appears for follow, block or DM with an unknown user ID, unban of a user who is not banned, and a bad `cursor` on notifications, admin users, profile posts and hashtag pages. |
| T8 | `users.service.ts:414,424,449,464` | "Most popular" users are sorted by `_count.followers`. In this schema `followers` means "accounts this user follows". Recommendations and Connect rank by the wrong number. The profile page hides this by swapping the two labels. | **Confirmed.** For a user with no follows, recommendations were user32 (follows 16), user3 (15), user48 (15). The most followed are user16 (16), user40 (15), user31 (15). The right bar in Chrome showed the same three wrong users. |
| T9 | `users.service.ts:398-477` | Recommendations and Connect do not filter blocked or banned users. Connect loads all users into memory. This breaks the blocking rule in CLAUDE.md. | **Confirmed** (memory use is code only). After carol blocked user32, recommendations still listed user32, and the connect list (9 pages, 107 users) still contained user32. A banned user (`t_eve`) was in the connect list. |
| T10 | `posts.service.ts:382-400`, `users.service.ts:133` | `findOne` and the profile "likes" tab ignore `isApproved`. A community post that waits for approval can be opened by URL or seen in a Likes tab. | **Confirmed.** A pending post (id 901) was returned by `GET /api/posts/901` to a user outside the community. In a second run, a pending post (id 883) liked by `t_cat` appeared in `/api/users/t_cat/posts?tab=likes`, with no cookie. |

### 4.2 Security

| ID | Where | Problem and effect | Evidence |
|---|---|---|---|
| S1 | `notifications.gateway.ts:48-73` | `newUser` joins any room by a username the client sends. DMs and notifications are pushed to that room. `sendNotification` lets a client fake a notification for anyone. `joinConversation` has no member check. A logged-in user can read another user's live DMs and notifications. | **Confirmed.** alice sent `newUser: "t_bob"` and then received bob's private DM from carol (`newMessage`, "secret DM for bob only"). alice's `sendNotification` for `t_carol` reached carol as a fake LIKE. alice joined the room of conversation 4 (she is not a member) and received `userTyping`. |
| S2 | `users.service.ts:47-49,81` | `GET /api/users/:username` returns the full user row except the password, to anyone, even logged out. Every user's email, role and banned flag are public. | **Confirmed.** With no cookie, `/api/users/t_bob` returned `email: t_bob@example.test`, `emailVerified`, `role: USER` and `banned: false`. |
| S3 | `posts.controller.ts:77`, `comments.controller.ts:59`, `messages.controller.ts` (whole class), `uploads.controller.ts:20`, `communities.controller.ts:31` | No `BannedUserGuard` on these writes. A ban only sends a socket event. The token stays valid and is not blacklisted (`admin.service.ts:41-65`). An admin can ban self or other admins. | **Confirmed** (banning another admin not run). Banned user `t_eve` (`/me` says `banned:true`) with her old cookie: create post 201, comment 201, upload 201, new DM and message 201, create community 201. Like, follow, report and delete gave 403. Login still gave her a cookie. The admin banned their own account (200), kept working, and unbanned it. |
| S4 | `uploads.service.ts:120` | On local disk, non-image files keep the user's file extension and are served from the API origin. A verified user can host an `.html` file at `/uploads/<id>.html`. | **Confirmed.** `evil.html` uploaded as `video/mp4` was saved as `<uuid>.html` and served at `/uploads/` with `content-type: text/html` (HTTP 200). The same with `text/html`. Local disk only, because Cloudinary was off. |
| S5 | `optional-jwt.guard.ts`, `notifications.gateway.ts:41-45` | The optional guard and the socket handshake do not check the logout blacklist. A logged-out cookie still gets personal feeds and a live socket. | **Confirmed (API and socket).** After logout, `/me` and like gave 401, but `GET /api/posts/1` still returned `likes:[{id:2001}]` (a guest gets `null`). A WebSocket opened with the logged-out token connected and accepted `newUser`. |
| S6 | `auth.service.ts:20,85-87` | Fallback secret `dev-secret-change-in-prod`. The OTP uses `Math.random`. OTP tries are limited only per IP (10 per minute). Fine for local work. Fix before any public deploy. A password reset does not end old sessions. | **Half confirmed.** After a password reset, the older session cookie still worked (`/me` 200). The fallback secret and the OTP limits are code only. |

### 4.3 Other bugs

| ID | Where | Problem and effect | Evidence |
|---|---|---|---|
| B1 | `communities.service.ts:380-395`, `communities.controller.ts:183-193` | Any `action` other than `'APPROVE'` removes the post. The `promote` role is not checked either (`:144-153`). A typo in a request deletes a post. | **Confirmed.** `{"action":"APROVE"}` returned 201 and the post was soft-deleted. An empty body `{}` also removed post 903. Promote with `role:"ADMIN"` gave 500. `OWNER` gave 403. |
| B2 | `communities/dto/community.dto.ts` | The community slug has no format rule. Slugs with spaces, `/` or capitals break `/c/<slug>` links. | **Confirmed.** Slug `Has Space/And Slash` was created (201). An empty slug gave 400. |
| B3 | `schema.prisma:104`, `RepostDto`, `posts.controller.ts` | Length limits live only in the database (post 255, comment 1,000). A report with no reason also fails there. Over-limit text gives a generic 500. | **Confirmed.** 300-char post gave 500. 400-char quote repost gave 500. 1,200-char comment gave 500. A report with no reason gave 500. `rePostId=99999999` gave 500. (A DM over 1,000 chars correctly gave 400, because that DTO has `MaxLength`.) |
| B4 | `InfiniteFeed.tsx:14-26` | The feed fetch never checks `res.ok`. A 429 or 500 answer becomes a page with no `posts`, and the feed crashes. | **Confirmed (UI).** After 1,300 requests to `/api/posts`, that route answered 429 and `/` showed "Something went wrong. Try again". |
| B5 | `(board)/layout.tsx:40-45`, `jwt.guard.ts:30` | The "verify your email" banner links to `/verify` without an email, so it shows "No email provided". The login token keeps `emailVerified: null` until the next login, while `/api/auth/me` reads the database. | **Confirmed (API and UI).** After verifying, the old cookie got `/me` "verified" but `POST /api/posts` gave 403 "Email not verified". A new login gave 201. UI: unverified `t_frank` sees the banner linking to `/verify`, and that page says "No email provided". |
| B6 | `communities.service.ts:268-277` | A community ban does not clear the member's cached community list (5 min). A banned member still sees that community in the Communities feed for up to 5 min. | **Confirmed.** In `club-two`, dave's Communities feed showed post 905. The mod banned dave (201). 11 s later the feed still showed 905. His join (403), post (403) and `isBanned:true` were correct. |
| B7 | `hashtags.service.ts:27-34` | Trending counts tags of deleted and community posts, is not cached, and a bad cursor gives 500. | **Confirmed for community posts.** Reported vs real (not deleted, not in a community): music 38 vs 16, photography 36 vs 12, books 36 vs 13, productivity 133 vs 113, coffee 82 vs 62. The trending API returned the inflated numbers. A bad cursor on the tag page gave 500. Counting deleted posts and "not cached" are code only. |
| B8 | `comments.service.ts:324-329`, `NotificationsFeed.tsx:21` | A comment like is sent as `LIKE` with the post ID, so the text says "liked your post". `Notification.commentId` is never filled. | **Confirmed.** After a comment like, the new `LIKE` rows had `postId` set and no `commentId`. |
| B9 | `LeftBar.tsx:17-20` | The "Explore" menu item links to `/`, not `/?feed=explore`. | **Confirmed.** In the page HTML, "Explore", "Homepage" and "More" all link to `/`. |
| B10 | `messages.service.ts:264-267` | `GET messages` sets `lastReadAt` but does not clear the `dm:unreadCount` cache (60 s). The unread number can lag. | **Confirmed.** After `GET messages` (no `PATCH /read`), the list still showed `unread:2` while `unread-count` said 1. After `PATCH /read` the list showed 0. |

### 4.4 New findings from the run

| ID | Where | Problem and effect | Evidence |
|---|---|---|---|
| N4 | `users/dto/update-user.dto.ts` (`img`, `cover`: only `IsString`), `Image.tsx`, `next.config.ts` | Any string is accepted as an avatar. `next/image` throws for hosts that are not in `remotePatterns`. Every server-rendered page that shows that user then returns 500: their own pages (the left bar shows their avatar), their profile, and **other people's notification pages**. | **Confirmed.** With `t_alice.img = https://evil.example/x.png`, every page was 500 for alice. For bob (his own avatar is empty), `/t_alice` and `/notifications` were 500, while `/`, `/user1` and `/communities` were 200. Frontend log: `Invalid src prop (https://evil.example/x.png) on next/image, hostname "evil.example" is not configured`. After the value was reset, all 26 pages gave the expected codes. |
| N5 | `Post.tsx` (post text inside a link to the status page), `RichText.tsx` (a link for each `@mention`) | `<a>` inside `<a>` for every post with a mention. React logs a hydration error and rebuilds the tree on the client. | **Confirmed (Chrome console).** "In HTML, `<a>` cannot be a descendant of `<a>`" and "Hydration failed because the server rendered HTML didn't match the client", on the post `hi @t_carol and @t_dave and @nobody`. |
| N2 | `comments.service.ts` `findByPost` | Comments have no block filter. A blocked user's comment is still shown to the person who blocked them. | **Confirmed.** carol blocked dave. On bob's post, carol still saw dave's comment. |
| N3 | `messages.service.ts` `findOrCreateConversation` | Check, then create, with no unique pair. Parallel creates make duplicate threads. | **Confirmed.** 5 parallel creates from dave to bob made 5 conversations (ids 9–13), and dave's list showed 5 threads with bob. DM search for `t_carol` returned 4 "users" for one person. |
| N1 | `posts.controller.ts` `create`, `comments.controller.ts` `create` | A post with no text and no media, and a comment with an empty body, are accepted. | **Confirmed.** Post 885 (no `desc`, no media) and comment 754 (`body:""`) were created. |
| N6 | `app.module.ts:28` | The limit key is route and IP, so each route has its own 1,000 per minute. The Next server calls from one IP, so all its users share each counter. | **Confirmed.** After 1,300 calls to `/api/posts`: `/api/posts` gave 429, while `/api/search`, `/api/hashtags/trending` and `/api/communities` gave 200. |
| N9 | `users.service.ts:310` | Every new follow row sends a notification, with no dedupe. Follow, unfollow and follow again repeats it. | **Confirmed.** bob had 8 FOLLOW notifications after 3 people followed him (6 came from alice's 6 parallel follow requests, which made 6 rows). |
| N10 | `posts.service.ts:679-695` | No unique key on (reporter, post). One user can report the same post many times, and each report notifies every admin. | **Confirmed.** carol's two reports on post 883 made 2 rows and 2 REPORT notifications. |
| N7 | `users.service.ts`, `search.service.ts` | Small API mistakes. An unknown profile name returns an empty list, not 404. `%` in search works as a wildcard. An empty search returns no `communities` key. | **Confirmed.** `GET /api/users/user1_nope/posts` gave 200 with an empty list. `q=%` returned 5 posts. `q=` returned the keys `hashtags`, `posts`, `users` only. |
| N8 | `(board)/@modal/compose/post` | Opening or refreshing `/compose/post` directly gives 404. It only works as an in-app modal. | **Confirmed.** `GET /compose/post` with a session cookie gave 404. |

### 4.5 Dead code, tooling and docs that disagree with the code

- **Unused (code only):** the `Account` and `Session` models; `Post.parentPostId` and its relation (comments moved to the `Comment` table, but queries still filter `parentPostId: null`); the `resend` npm package; the env names `STORAGE_DRIVER`, `RESEND_API_KEY` and `EMAIL_FROM`.
- **Dependencies:** 66 reported vulnerabilities (3 critical) and one deprecated package. Not checked further.
- **CLAUDE.md** says the seed makes `user1`–`user5`. The code makes 50 (`seed.ts:39`, confirmed by the run). This one is ours and should be fixed.
- **README** says `npm run dev:reset` for local work. It runs `db push --force-reset`, which wipes the database and skips migrations. CLAUDE.md says to use migrations. README also calls Explore "trending by likes", but the code uses the weighted score.
- **Pre-thesis docs** (frozen): `docs/testcase.md` says verify returns a session cookie, but the code only returns `ok` and the user must sign in (confirmed by the run). `docs/feed_implementation_now.md` says page size 3, but the code uses 10. These go into `prethesis-corrections.md`, not into the old files.

---

## 5. Decisions for the author

1. **Counts (T1, T2).** The parity test in P6 needs the live counts to match the harness counts. I recommend fixing both now: count only rows with `deletedAt: null`. The change is small and sits in four files. Note it in `prethesis-corrections.md`.
2. **Graph clean-up (T5, T6, T7, T9).** Block self-follow and unknown IDs in `toggleFollow`. In P2, remove the duplicates (53 like pairs, 45 follow pairs, 3 saved pairs in the clean seed) before adding the unique keys. Filter blocked and banned users from Recommendations and Connect.
3. **Non-members posting in a community.** Today anyone can submit a post to any community, and it goes to the approval queue (`posts.service.ts:413-427`). The community term in the score assumes "member" means something. I recommend requiring membership. This is your call: it changes product behavior.
4. **Avatar URL (N4).** One user can make other people's pages return 500. I recommend accepting only uploaded file names or the allowed hosts in `img` and `cover`. This is small and worth doing before any demo.

**Suggested order** (the author has not chosen yet):

1. On the thesis path: T1, T2, T5, T6, T7, T9, T10.
2. Pages that crash: N4, B4, N5.
3. Security: S1–S5, then S6 and N6 before any public deploy.
4. The rest (B1–B3, B5–B10, N1–N3, N7–N10).

---

## 6. How complete is this review

- **Read in full:** every backend controller and service, the Prisma schema, the seed, Docker files, `Makefile`, the env examples, the frontend fetch layer, middleware, layouts, the home and feed components, the post card, compose box, post interactions, profile page, notifications, community page, and the admin layout.
- **Mapped by search only:** the other frontend components (chat popup and drawer, comments UI, image editor, community admin UI, admin tables). I listed every `/api/...` path in the frontend (59 path patterns) and checked that each one exists in the backend. None is missing.
- **Run:** hundreds of curl requests over all 13 modules, two Socket.IO scripts, a Chrome session (login, compose, repost menu, the 429 crash, the console errors), and a sweep of 26 pages. A second, short run (clean database) rechecked the seed duplicates, MENTION notifications, the Likes tab, admin self-ban and the logged-out socket.
- **Not run:** real email and Cloudinary (switched off on purpose), the chat and image-editor UI, infinite scroll, `next build`, the Docker image builds, load tests, and mobile layout. Expired codes and expired tokens were not tested. The code-only parts are marked in the Evidence cells.
