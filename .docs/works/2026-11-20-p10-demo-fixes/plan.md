# Plan: Demo fixes V1 to V5

Status: done · 2026-11-20
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-20-p10-demo-fixes/`

Backend steps write their IT tests first and see them fail for the right reason. The frontend has no tests; its checks are the Acceptance items, done by Opus in Chrome. Docker db and redis must run. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Approve keeps `updatedAt` and refreshes the feed (V3, V4 backend).** Write TC1, TC2 and TC3 in the new `test/it/demo-fixes.it-spec.ts` (TC2 and TC3 on an app with the cache on, as `quick-wins.it-spec.ts` does for TC7). Then change the APPROVE branch of `CommunitiesService.moderatePost`: write `updatedAt: post.updatedAt` with `isApproved: true`, and after the update bump `v:user` for the set of ids {approver, author}. If TC1 still fails after the change (Prisma overwrites `updatedAt`), stop and report (F1). (Design: Approach "V3", "V4"; F1–F3.) Commit: `fix(communities): approve keeps updatedAt and refreshes the feed (V3, V4)`

- [x] 2. **Frontend (V1, V2, V4, V5).** In this order, each a small change: `ChatDrawer.tsx` uses the key `["conversations", "drawer"]` (V1); `Comments.tsx` sends the window event `post:comment-added` with `{ postId }` after a comment or a reply is created, and `PostInteractions.tsx` listens and adds 1 to its `comments` count for the same `postId`, removing the listener on unmount (V2); `PendingPostsBanner.tsx` also invalidates `["posts"]` after an approve (V4); `app/sign-in/layout.tsx` returns only its children and keeps `metadata` (V5). Frontend typecheck and lint must pass. (Design: Approach "V1", "V2", "V4", "V5"; F5–F10.) Commit: `fix(frontend): drawer key, live comment count, feed refetch on approve, one root layout (V1, V2, V4, V5)`

- [x] 3. **Docs.** `.docs/Bugs Report.md`: V1–V5 move from §3.5 to §5 with their commits, §1 counts (resolved 29 → 34, open 19 → 14, and the P3 and P4 numbers), §6 row "P10, before the demo" done on 2026-11-20. `.docs/implementation-plan.md` §5: a row for this task between rows 21 and 22 (✅ 11-20), the version line and a change-log line. Check that `docs/System_Architecture.md` and the Guidance Manual name none of V1–V5. Commit: `docs: p10-demo-fixes in the Bugs Report and the implementation plan`

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW3 | IT | a member posts in a community (pending), the owner approves: the post's `updatedAt` equals its `createdAt` (same millisecond) after the approve, and `isApproved` is true |
| TC2 | DW4 | IT (cache on) | the owner reads `GET /api/posts?communityId=<id>` (no post), approves the pending post, reads again at once: the second page has the post |
| TC3 | DW4, F3 | IT (cache on) | the same with a mod as the approver: the mod's second read has the post; the author's feed read after the approve also has it |

DW1, DW2, DW5 and DW6 are Acceptance items (Chrome); DW7 and DW8 are A5.

## Acceptance

Opus does these after Step 3, with the backend from `run-safe.sh` and the frontend dev server.

- [x] A1 (DW1, V1). In Chrome, `/messages` and `/messages/<id>` for a user with a conversation → no "Hydration failed" in the console; the list shows the conversations; the chat drawer, opened from the home page, still lists them.
- [x] A2 (DW2, V2). In Chrome, add a top-level comment on a post's status page → the header comment count goes up by 1 without a reload; a reply also adds 1.
- [x] A3 (DW3, DW4, V3, V4). In Chrome, as a community owner, approve a pending post → it shows in the community feed right away, with no "(edited)".
- [x] A4 (DW5, V5). In Chrome, sign out from the home page, then open `/sign-in` directly → no "`<html>` cannot be a child of `<body>`" and no "mounting a new html" error; the title is "Breadit".
- [x] A5 (DW6, DW7, DW8). Edit a post's text → the card shows "(edited)". `verify.sh` → all green. `test:parity` → passes.

## Result

Delivered on 2026-11-20. V1–V5 are fixed. Nothing is pushed.

**Commits** (on `test-app`): `8a28bbc` V3 and V4 backend (with TC1–TC3), `b0782fe` V1, V2, V4 and V5 frontend, `3c10f63` docs, and the closing commit.

**Tests.** Unit 211 (unchanged). IT 168 → 171 (TC1–TC3 in `demo-fixes.it-spec.ts`); each failed first for the expected reason (TC1: `updatedAt` moved 70 ms; TC2 and TC3: the second read returned the cached empty page). Opus ran `verify.sh`: all 9 checks pass (ranking 85, unit 211, IT 171). `test:parity`: 102 passed.

**Acceptance (Opus, Chrome; clicks sent from JavaScript, as in the sweep).**
- A1: `/messages` and `/messages/7` as `user1`: the list shows `User 2`, no console error (before: "Hydration failed"). The drawer, opened with the Chat button on the home page, shows "User 2 … Sweep W10 live message".
- A2: on `/user2/status/320` the header count went 2 → 3 after a comment and 3 → 4 after a reply, with no reload.
- A3: `user2` posted 930 in `sweep_p10` (pending); `user1` approved it; the post was in the community feed at once (before: up to 10 s and a reload), with no "(edited)"; no console error.
- A4: logout from the home page → `/sign-in`, title "Breadit", no console error; a direct load of `/sign-in` has one `<html>` and one `<body>` and no console error.
- A5: post 926 edited through `PATCH /api/posts/926` (200) → its status page shows "(edited)". `verify.sh` and `test:parity` as above.

**Differences from the design.**
- V2: `PostInteractions` did not keep the comment count in `useState` (it showed `count.comments` from props), so the design's premise and its rejected option "router.refresh()" were not accurate. The fix adds a `commentsAdded` counter and shows `count.comments + commentsAdded`; the behaviour is the one the design asked for. If the props ever change after a local add (no page does this today), the count could be one too high until a reload.
- Implementation-plan row 21b has no day budget ("—").
