# Plan: Demo fixes V1 to V5

Status: approved · 2026-11-20
Design: [design.md](design.md) · Folder: `.docs/works/2026-11-20-p10-demo-fixes/`

Backend steps write their IT tests first and see them fail for the right reason. The frontend has no tests; its checks are the Acceptance items, done by Opus in Chrome. Docker db and redis must run. All commits go on `test-app` and are never pushed. Approving this plan approves the commits below.

## Steps

- [x] 1. **Approve keeps `updatedAt` and refreshes the feed (V3, V4 backend).** Write TC1, TC2 and TC3 in the new `test/it/demo-fixes.it-spec.ts` (TC2 and TC3 on an app with the cache on, as `quick-wins.it-spec.ts` does for TC7). Then change the APPROVE branch of `CommunitiesService.moderatePost`: write `updatedAt: post.updatedAt` with `isApproved: true`, and after the update bump `v:user` for the set of ids {approver, author}. If TC1 still fails after the change (Prisma overwrites `updatedAt`), stop and report (F1). (Design: Approach "V3", "V4"; F1–F3.) Commit: `fix(communities): approve keeps updatedAt and refreshes the feed (V3, V4)`

- [x] 2. **Frontend (V1, V2, V4, V5).** In this order, each a small change: `ChatDrawer.tsx` uses the key `["conversations", "drawer"]` (V1); `Comments.tsx` sends the window event `post:comment-added` with `{ postId }` after a comment or a reply is created, and `PostInteractions.tsx` listens and adds 1 to its `comments` count for the same `postId`, removing the listener on unmount (V2); `PendingPostsBanner.tsx` also invalidates `["posts"]` after an approve (V4); `app/sign-in/layout.tsx` returns only its children and keeps `metadata` (V5). Frontend typecheck and lint must pass. (Design: Approach "V1", "V2", "V4", "V5"; F5–F10.) Commit: `fix(frontend): drawer key, live comment count, feed refetch on approve, one root layout (V1, V2, V4, V5)`

- [ ] 3. **Docs.** `.docs/Bugs Report.md`: V1–V5 move from §3.5 to §5 with their commits, §1 counts (resolved 29 → 34, open 19 → 14, and the P3 and P4 numbers), §6 row "P10, before the demo" done on 2026-11-20. `.docs/implementation-plan.md` §5: a row for this task between rows 21 and 22 (✅ 11-20), the version line and a change-log line. Check that `docs/System_Architecture.md` and the Guidance Manual name none of V1–V5. Commit: `docs: p10-demo-fixes in the Bugs Report and the implementation plan`

## Tests

| ID | Covers | Level | What it checks |
|---|---|---|---|
| TC1 | DW3 | IT | a member posts in a community (pending), the owner approves: the post's `updatedAt` equals its `createdAt` (same millisecond) after the approve, and `isApproved` is true |
| TC2 | DW4 | IT (cache on) | the owner reads `GET /api/posts?communityId=<id>` (no post), approves the pending post, reads again at once: the second page has the post |
| TC3 | DW4, F3 | IT (cache on) | the same with a mod as the approver: the mod's second read has the post; the author's feed read after the approve also has it |

DW1, DW2, DW5 and DW6 are Acceptance items (Chrome); DW7 and DW8 are A5.

## Acceptance

Opus does these after Step 3, with the backend from `run-safe.sh` and the frontend dev server.

- [ ] A1 (DW1, V1). In Chrome, `/messages` and `/messages/<id>` for a user with a conversation → no "Hydration failed" in the console; the list shows the conversations; the chat drawer, opened from the home page, still lists them.
- [ ] A2 (DW2, V2). In Chrome, add a top-level comment on a post's status page → the header comment count goes up by 1 without a reload; a reply also adds 1.
- [ ] A3 (DW3, DW4, V3, V4). In Chrome, as a community owner, approve a pending post → it shows in the community feed right away, with no "(edited)".
- [ ] A4 (DW5, V5). In Chrome, sign out from the home page, then open `/sign-in` directly → no "`<html>` cannot be a child of `<body>`" and no "mounting a new html" error; the title is "Breadit".
- [ ] A5 (DW6, DW7, DW8). Edit a post's text → the card shows "(edited)". `verify.sh` → all green. `test:parity` → passes.

## Result
