# Pre-thesis verify

2026-10-21 · branch `test-app` · code unchanged (nothing was fixed in this run)

This is the run that goes with [Pre-thesis check.md](Pre-thesis%20check.md). I started the whole system on this Mac and tested it with curl, one Socket.IO script and a real Chrome session. Finding IDs (T, S, B) are the same as in the check doc.

---

## 1. Result

**25 of the 26 findings are confirmed. Only S6 is half confirmed.** The one thing in the check doc that was wrong: the rate limit is counted **per route** per IP, not once for the whole API (see section 5).

The app itself works. All 72 routes start, all 26 pages render, and the main flows pass (list in section 3). The bugs are in the edges: counts after deletes, the 10-second cache, missing checks on IDs and lengths, and a few security gaps.

I also found 10 new problems (section 4). The worst is N4: one user can set an avatar URL that makes other people's pages return 500. The full table, with code locations, is in the check doc.

---

## 2. How it was run

- **Services.** Postgres 16 and Redis 7 in Docker (ports 5433 and 6378). Backend with `node dist/main.js` on port 4000. Frontend with `next dev` on port 3000. The frontend app was not run in Docker, to save memory.
- **Setup steps.** `npm ci`, `npm run build -w @breadit/shared`, `prisma generate`, `prisma migrate deploy` (all 18 migrations passed on an empty database), `prisma db seed`. Backend build and frontend `tsc --noEmit` pass. Frontend lint gives warnings only.
- **Safety.** `.env` holds a real Gmail SMTP login and a Cloudinary key. For the backend process only, I set SMTP to a dead local port and blanked Cloudinary, so no email was sent and every upload went to a scratch folder. `.env` was not changed. For the same reason, email codes were read from the `VerificationToken` table.
- **Test users.** Seed users (`admin`, `user1`–`user50`) plus 7 users named `t_*` that I created.
- **Browser.** Chrome, signed in as `t_bob` (a throwaway local test account).

---

## 3. What works

- **Auth.** Register, email code verify, login, logout (the token is blacklisted for protected routes), `me`, forgot and reset password. Validation errors give 400. Login and register stop at 10 per minute (429).
- **Posts and feeds.** For You, Explore, Following, Communities, profile and community feeds. Cursor chains give no duplicates. Create (text, images, video, up to 10 files), edit (hashtags and media updated), delete. Only the owner can edit or delete.
- **Interactions.** Like, save, repost, quote-repost, nested comments (5 levels), comment edit and like, comment sorts.
- **People.** Follow, unfollow, block (hides feed, Explore, search, profile, DM and direct post links), profile tabs, profile edit (it ignores `username`, `role` and `email`), saved posts, notifications (list, unread, mark one, mark all, pages).
- **Communities.** Create, duplicate slug check, join and leave, owner cannot leave, approval queue, approve, rules, edit info, images, promote, ban and unban, transfer owner, delete (posts are soft-deleted).
- **DMs.** Create, send, length check, members only, unread counts, read, search.
- **Admin.** User list and search, ban and unban, report list, dismiss, delete reported post. Non-admins get 403 or a redirect.
- **Socket.IO.** Connect with the cookie, `newUser`, live `newMessage`, `getNotification`, typing events, `accountBanned`.
- **Frontend.** Login works in Chrome (the cookie with `Domain=localhost` is accepted). The banned screen, the verify banner, repost menu and compose box work.

### Confirmed findings

| ID | How I confirmed it |
|---|---|
| T1 | API: after un-repost, the post still shows `rePosts:1` and my repost flag; the next toggle made a second row (live 1, total 2). **UI:** after "Undo Repost" and a reload, the count is 1 and the icon is green. The database has only a soft-deleted repost. |
| T2 | After deleting a reply, `_count.comments` stays 2 while the thread shows 1 comment. |
| T3 | API and **UI**: the post is saved, but the feed refetch does not show it for 10 s. With the cache off, it shows at once. |
| T4 | The same Explore page gave `nextCursor` `699:557`, then `696:557` about ten minutes later. |
| T5 | Self-follow made a row (`following:true`) and self-block was accepted. Follow or block of an unknown ID gives 500. |
| T6 | 6 parallel likes made 6 rows. 6 parallel follows made 6 rows, and one unfollow left 5. The **clean seed already has** 53 duplicate like pairs (54 extra rows), 45 duplicate follow pairs (48 extra rows) and 3 duplicate saved pairs. (My first count, 54 and 46, was taken after my own parallel tests and included one pair each from them. I recounted on a freshly seeded database.) |
| T7 | Like, save and report of a missing post give 500. Like, save, repost and comment on a soft-deleted post succeed. `/api/posts/abc` gives 500. |
| T8 | Recommendations gave user32, user3, user48. The most followed are user16, user40, user31. Profile counts: `followers` is the number of accounts the user follows. |
| T9 | A blocked user (user32) still appears in recommendations and in the connect list. A banned user appears in connect. |
| T10 | A random user fetched a post that waits for approval by its ID. In a second run, a pending post liked by another user also showed in that user's public Likes tab. |
| S1 | alice said `newUser: t_bob` and received bob's private DM. A fake notification reached carol. A non-member got typing events from another DM room. |
| S2 | A logged-out request to `/api/users/t_bob` returns the email, `emailVerified`, `role` and `banned`. |
| S3 | A banned user with the old cookie could post, comment, upload, send a DM and create a community (all 201). Like, follow, report and delete were blocked (403). In the second run, an admin banned their own account, kept working and unbanned it. |
| S4 | An `.html` file uploaded with `video/mp4` was served from `/uploads/` as `text/html`. |
| S5 | After logout, the old cookie still returned personal data (`likes:[{id:...}]`) on a public route. In the second run, a WebSocket opened with a logged-out token connected and accepted `newUser`. |
| S6 | Half: a password reset does not end the old session (confirmed). The fallback secret and the OTP limits were not run. |
| B1 | An `APROVE` typo and an empty body both removed the post. Promote with role `ADMIN` gives 500. |
| B2 | A slug `Has Space/And Slash` was accepted. |
| B3 | A 300-char post, 400-char quote repost and 1,200-char comment give 500. A report with no reason gives 500. |
| B4 | **UI:** when `/api/posts` answers 429, the home page shows "Something went wrong. Try again". |
| B5 | A verified user's old cookie still gets 403 on writes while `/me` says verified. The banner links to `/verify`, which shows "No email provided". |
| B6 | Eleven seconds after a community ban, the banned member still saw that community's post in the Communities feed. |
| B7 | Trending counts community posts: "music" reports 38 but has 16 real posts. A bad cursor gives 500. |
| B8 | A comment like sends `LIKE` with the post ID and no `commentId`. |
| B9 | The left-bar "Explore" link goes to `/`. |
| B10 | After `GET messages`, the list still showed 2 unread while `unread-count` said 1. |

---

## 4. New findings

| ID | Where | What happens |
|---|---|---|
| N4 | Profile `img` and `cover` (`update-user.dto.ts`), `Image.tsx` | Any URL is accepted. `next/image` throws for hosts not in `next.config.ts`. With `img=https://evil.example/x.png`, that user's own pages, their profile and **other users' notification pages** return 500. Highest risk of the new ones. |
| N5 | `Post.tsx` wraps the post text in a link, and `RichText` puts a link for each `@mention` inside it | `<a>` inside `<a>`. React logs a hydration error and rebuilds the tree on the client for every post with a mention. |
| N1 | `posts.service.ts`, `comments.service.ts` | A post with no text and no media, and a comment with an empty body, are accepted. |
| N2 | `comments.service.ts` `findByPost` | Comments from a blocked user are still shown to the person who blocked them. |
| N3 | `messages.service.ts` `findOrCreateConversation` | 5 parallel creates made 5 conversations between the same two users. They show as 5 threads, and DM search returns the same person several times. |
| N9 | `notifications.service.ts` | Every new follow row sends a new notification. Bob got 8 FOLLOW notifications from 3 real people. |
| N10 | `posts.service.ts` `createReport` | The same user can report the same post many times. Two reports from carol made 2 rows and 2 admin notifications. |
| N6 | `app.module.ts:28` | The 1,000 per minute limit is counted per route per IP. Flooding `/api/posts` gave 429 there, while search, trending and communities stayed 200. The Next server calls from one IP, so all its users share one counter. |
| N7 | search and users | `GET /api/users/<unknown>/posts` returns 200 with an empty list. Search treats `%` as a wildcard. An empty search returns an object with no `communities` key. |
| N8 | `(board)/@modal/compose/post` | Opening or refreshing `/compose/post` directly gives 404. It only works as an in-app modal. |

---

## 5. What this means for the thesis

- **Seed data is not clean.** The seeded database already has duplicate likes, follows and saves (T6). The P2 migration has to remove them first, as the plan says. Any feature built on the seed would count them twice.
- **The k6 explanation is now much stronger.** The old limit (120 per minute) was per route. A k6 run that hits one Explore route would fail most requests with 429, which matches the 71% failures in `k6_results.json`. I still did not test it with the old limit, so it is a strong fit, not a proof.
- **Feed tests need the cache off.** T3 and T4 are real. The parity test and the harness must use `REDIS_HTTP_CACHE_ENABLED=false`, as P6 already says.
- **The graph needs fixes before it is read.** T5 (self-follow), T6 (duplicates) and T9 (blocked or banned users in lists) all touch the follow graph and the blocking rule that the hybrid score depends on.

---

## 6. Not tested

- Real email delivery and the Cloudinary upload path (disabled on purpose).
- Chat popup and drawer UI, typing dots in the UI, infinite scroll, the image editor, profile photo upload in the UI, the post edit modal, the report dialog, and the admin buttons. I only tested the matching API routes.
- `next build` and the two Docker image builds.
- Load tests (k6) and mobile layout.
- Expired codes and expired tokens, the 30-day token life, and an admin banning themselves (checked by reading the code only).

---

## 7. State left behind and how to rerun

- **Database.** The first test database was lost between my two runs: the Postgres volume was recreated (its creation time was after my last run). I do not know what removed it, possibly a Docker cleanup. I rebuilt it with `migrate deploy` and the seed, then ran a short second check. It now holds the seed plus 3 `t_*` users (`t_ann`, `t_ben`, `t_cat`), a few posts and one test community (`probe-club`). The containers are stopped and the volume is kept. To reset it: `docker compose down -v`, then migrate and seed again.
- **Git.** Only the two `.docs` files are new. `npm ci` ran the husky hook install and set the local `core.hooksPath` to `.husky/_`. New folders (`node_modules`, `dist`, `.next`) are all git-ignored.
- **Uploads** from the test went to the scratch folder, not into the repo.
- **To run again:**
  1. `docker compose up db redis -d`
  2. `npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma`, then `npx prisma db seed --schema=apps/backend/prisma/schema.prisma`
  3. Build the backend (`npm run build -w @breadit/backend`). Start it from `apps/backend` with `node dist/main.js`. Export `DATABASE_URL`, `REDIS_URL`, `FRONTEND_URL`, `JWT_SECRET` and `COOKIE_DOMAIN` first, and override the SMTP and Cloudinary variables as in section 2.
  4. From `apps/frontend`, run `BACKEND_INTERNAL_URL=http://localhost:4000 NEXT_PUBLIC_BACKEND_URL=http://localhost:4000 npx next dev -p 3000`.
