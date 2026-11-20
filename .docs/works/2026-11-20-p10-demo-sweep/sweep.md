# Demo sweep record

Task: [design.md](design.md) · [plan.md](plan.md) · Date: 2026-11-20

This file is the record of the sweep. Every check is a row with its expected result, written before the run. During the run, the columns "Result", "How clicked" and "Evidence" are filled: PASS or FAIL, how the page was driven, and the proof (URL, HTTP status, console text, screenshot name). A FAIL that is a known open bug gets its ID in "Evidence". A FAIL that is new gets a V-series row in `.docs/Bugs Report.md`.

## 1. Setup

| Item | Value |
|---|---|
| Backend | `bash .claude/hooks/run-safe.sh start` on :4000 (schema `public`, email and Cloudinary off, uploads on local disk, feed cache on) |
| Frontend | dev server on :3000 with `BACKEND_INTERNAL_URL` and `NEXT_PUBLIC_BACKEND_URL` set to `http://localhost:4000` (no `.env` in `apps/frontend`) |
| Browser | one Chrome tab from the extension; clicks are sent from JavaScript when the mouse does not reach the page (F1) |
| Data | dev data in schema `public` (seed `user1`–`user50`, `admin`, `human01`–`human50`, rows of earlier sweeps) |
| Node | v22.23.4 |
| Check per page | HTTP status of the navigation; the text "Something went wrong" is absent and the main content is there; console errors since the load (only `error` level, F7) |

### Users and ids (read from schema `public`, 2026-11-20)

| Who | Username | Id | Used for |
|---|---|---|---|
| main viewer in Chrome | `user1` (`user1@example.com`, password `password`) | `seed_user_0001` | all `(board)` pages, flows W1–W13, W15; owner of the sweep community |
| second user (script) | `user2` (`user2@example.com`, password `password`) | `seed_user_0002` | DM, typing, like, join, post in community; the profile pages |
| admin | `admin` (`admin@breadit.dev`, password `123456`) | `cmvhxyeoq0000w6i5px3m8qkx` | the admin pages, the ban in W13 (script and Chrome) |

Starting state of `user1`: follows 7, followed by 6, 37 likes, not a member of any community, no block. `user1` and `user2` do not follow each other. No open report.

| What | Value |
|---|---|
| conversation `user1`–`user2` | `7` (made by the `dm` try below; it did not exist before) |
| a post of `user2` for `status/[postId]` | `320` ("Post 10 by user2 #tag0103 #tag0112", seed) |
| a post of `user1` that `user2` likes in W11 | `310` ("Post 10 by user1 #homecooking #tag0084"; `user2` has not liked it) |
| hashtag with many posts | `productivity` (133 posts) |
| community for the page rows | `webdev` (id 1, seed; `user1` is not a member) |
| sweep community made in W9 | slug `sweep-p10`, name "Sweep P10" (the slug is free); its id is written in the W9 row |

Not used to sign in: the `human*` users (no password).

### Tries of the second-user script (step 2)

Script: [second-user.mjs](second-user.mjs). Run from the repo root: `node .docs/works/2026-11-20-p10-demo-sweep/second-user.mjs <command> [args]`. It signs in only the user a command needs, once per run, and prints the HTTP status of each call. `BASE_URL` defaults to `http://localhost:4000`. Each command was tried once against the backend from `run-safe.sh`. For `typing` and `dm`, a throwaway listener (not part of the task) was signed in as `user1` at the same time and saw the events.

| Command tried | HTTP statuses | Result |
|---|---|---|
| `dm user1 "second-user.mjs try: hello from user2"` | login 200, `GET /api/users/user1` 200, `POST /api/conversations` 201, `POST /api/conversations/7/messages` 201 | conversation `7` created, message `5` sent. The listener got `newMessage`. |
| `typing 7` | login 200; the socket connected (the gateway sends no reply to the events, so there is no status) | the listener got `userTyping` (`conversationId` 7, `username` `user2`) and, 3 s later, `userStopTyping` |
| `like 330` (a seed post of `user3`, so post 310 stays free for W11) | login 200, `POST /api/posts/330/like` 200 | `{"liked":true,"count":4}` |
| `join sw-d4c97d` (community of an earlier sweep) | login 200, `GET /api/communities/sw-d4c97d` 200, `POST /api/communities/13/join` 201 | `{"joined":true}` |
| `post-in-community 13 "second-user.mjs try: pending post from user2"` | login 200, `POST /api/posts` 201 | post `907`, `isApproved` false (a member's post waits for approval) |
| `ban cmwowoluy0002w6aa75vwxynq` (throwaway `sw_carol_d4c97d`) | login 200, `POST /api/admin/users/<id>/ban` 200 | `{"ok":true}`; the database showed `banned = true` |
| `unban cmwowoluy0002w6aa75vwxynq` | login 200, `POST /api/admin/users/<id>/unban` 200 | `{"ok":true}`; the database showed `banned = false` |

Notes on the script:
- `like` and `join` are toggles: a second call undoes the first. In W11 call `like 310` once.
- `ban` refuses `admin` always (R6), and `user1` and `user2` unless `--force` is added. W13 needs `ban seed_user_0001 --force`. `unban` has no limit, so the cleanup can always lift a ban. This was checked against a mock server on another port, with no call to the real API.
- The first `ban` and `unban` runs used a wrong id and got 404 (no data changed); they were run again with the right id. The table shows the second runs, made with the final script.
- Tries left rows in `public`: conversation 7 with one message from `user2` (unread for `user1`), a like of `user2` on post 330, `user2` as a member of `sw-d4c97d` with the pending post 907. The throwaway user is unbanned.

## 2. DW1: `verify-bug-sweep.sh`

Run: `bash scripts/verify-bug-sweep.sh` against a fresh backend from `run-safe.sh` (it includes `scripts/verify-socket.cjs`).

| Check | Expected | Result | How run | Evidence |
|---|---|---|---|---|
| DW1 | 95 passed, 0 failed, the socket checks included | PASS: `== 95 passed, 0 failed, 0 skipped` (run `0222dd`, about 9 s). The 11 socket checks (W, S1, S5) all PASS. | script from the shell | The first run (id `b250cc`) gave 88 passed, 7 failed: the seven socket rows failed with HTTP 401 because the second login of `carol` was the 11th login in one minute (my script runs from step 2 had used 4 of the 10; the script does not print login codes, so the 429 is counted, not seen). It was run again after 70 s and all rows passed. Not an app bug. |

## 3. Pages (DW2)

28 pages (`apps/frontend/src/app/**/page.tsx`; the compose modal `@modal/(.)compose/post` is the 29th file and is checked in W4). `(board)` pages and `admin-console` need a session: the middleware sends a guest to `/sign-in`.

| # | Page (URL) | User | Id used | Expected | Result | How clicked | Evidence |
|---|---|---|---|---|---|---|---|
| P1 | `/sign-in` | guest | | renders the sign-in form, no console error | | | |
| P2 | `/sign-up` | guest | | renders the form (username, email, password) | | | |
| P3 | `/verify` | guest | opened twice: `?email=user1@example.com` and with no email | with email: "Check your inbox" and the code form; without: "No email provided" | | | |
| P4 | `/forgot-password` | guest | | renders the email form | | | |
| P5 | `/reset` | guest | opened with no token | shows "Invalid reset link" and a link to `/forgot-password` | | | |
| P6 | `/` (home) | `user1` | | For You tab, compose box and posts | | | |
| P7 | `/compose/post` | `user1` | | the compose page with a close button (direct load) | | | |
| P8 | `/profile` | `user1` | | redirects to `/user1` | | | |
| P9 | `/[username]` | `user1` | `user2` | profile of `user2`: name, counts, posts | | | |
| P10 | `/[username]/followers` | `user1` | `user2` | list of followers, no error | | | |
| P11 | `/[username]/following` | `user1` | `user2` | list of followed users, no error | | | |
| P12 | `/[username]/status/[postId]` | `user1` | `user2`, post `320` | the post and its comments | | | |
| P13 | `/bookmarks` | `user1` | | "Bookmarks" with saved posts or "No bookmarks yet" | | | |
| P14 | `/communities` | `user1` | | "Communities" with a list of communities | | | |
| P15 | `/communities/new` | `user1` | | "Create a Community" form | | | |
| P16 | `/c/[slug]` | `user1` | `webdev` (the owner view of `sweep-p10` is seen in W9) | community header and posts | | | |
| P17 | `/c/[slug]/about` | `user1` | `webdev` | "About Community", "Rules", "Members" | | | |
| P18 | `/connect` | `user1` | | "Connect, People you might know" with users (R5 may make it slow) | | | |
| P19 | `/hashtag/[tag]` | `user1` | `productivity` | "#productivity" with posts | | | |
| P20 | `/messages` | `user1` | | conversation list and "Select a message" | | | |
| P21 | `/messages/[conversationId]` | `user1` | `7` | the thread with `user2` and the try message | | | |
| P22 | `/notifications` | `user1` | | "Notifications" with a list or an empty text | | | |
| P23 | `/search` | `user1` | `?q=user2` | "Search results for "user2"" with users and posts | | | |
| P24 | `/settings` | `user1` | | "Settings" with a link to blocked accounts | | | |
| P25 | `/settings/blocked` | `user1` | | "Blocked accounts" with an empty list | | | |
| P26 | `/admin-console` | `admin` | | redirects to `/admin-console/users` | | | |
| P27 | `/admin-console/users` | `admin` | | "Manage Users" table | | | |
| P28 | `/admin-console/reports` | `admin` | | "Reported Content" table (no open report: empty) | | | |

## 4. Flows (DW3 to DW6)

Done in this order, each flow builds on the one before.

| # | Flow | Expected | Result | How clicked | Evidence |
|---|---|---|---|---|---|
| W1 | sign in as `user1` in Chrome | home page, For You tab | | | |
| W2 | For You with Chronological, Engagement, Social (`/?algo=chrono`, `engagement`, `social`) | three pages; the first ten post ids are not the same in all three (DW4). If `user1` has too little history, use a seed user with more and say which (F9). | | | |
| W3 | Explore, Following, Communities tabs (`/?feed=explore`, `following`, `communities`) | each loads posts, no error | | | |
| W4 | compose with text, a `#tag`, an `@user2` mention and one image; open it both from the Post button (modal) and from `/compose/post` | the post appears on top of the user's profile; the image loads; the tag and mention are links | | | |
| W5 | like, repost, quote repost, save, then undo each | the counts go up and back down | | | |
| W6 | comment, reply, like a comment, delete the reply | the thread shows the right comments and counts | | | |
| W7 | follow and unfollow `user2` from `/user2` | the button and the follower count change | | | |
| W8 | search a word, open a hashtag page | users, posts and tags are listed | | | |
| W9 | `user1` creates the community `sweep-p10`; `user2` joins (`join sweep-p10`) and posts (`post-in-community <id> <text>`); `user1` approves | the post moves from the approval queue to the community feed. Community id: ____ | | | |
| W10 | a direct message from `user2` (`dm 7 <text>`, after `typing 7`) while `user1` has `/messages/7` open | the message appears without a reload, with the typing sign first (DW5) | | | |
| W11 | `user2` likes a post of `user1` (`like 310`) | the notification count goes up without a reload, and the list shows it (DW5) | | | |
| W12 | `user1` blocks `user2`, then unblocks | `user2`'s posts and comments are hidden, then back | | | |
| W13 | admin bans `user1` (`ban seed_user_0001 --force`) while `user1`'s page is open, then unbans (`unban seed_user_0001`) | `user1`'s page goes to sign-in (DW6); after the unban `user1` can sign in again | | | |
| W14 | admin console: users table, reports table; `user1` opens `/admin-console/users` | both tables render; non-admin `user1` is redirected | | | |
| W15 | sign out | sign-in page; the old cookie is a guest on public routes | | | |

## 5. Cleanup (F5)

Always run, even after a FAIL.

| Step | Expected | Done | Evidence |
|---|---|---|---|
| `unban seed_user_0001` | `user1` has `banned = false` | | |
| `user1` unblocks `user2` | no block row between them | | |
| `user1` signs in again | login 200 and the home page opens | | |
| stop the backend and the frontend, close the Chrome tab | nothing listens on :3000 and :4000 | | |

## 6. Known open bugs seen

None yet. Write here every FAIL that is a known bug (R5, N7, B8, N9, B5, R6), with the row it appeared in.

## 7. New problems (V series)

None yet. Each new FAIL gets a row in `.docs/Bugs Report.md` §3 (V1, V2, ...) and is listed here with its row.
