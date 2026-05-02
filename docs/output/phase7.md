# Phase 7 — Safety: Block & Report

## What Was Implemented

Phase 7 adds two user-safety primitives. **Block** lets User A hide User B's content from every surface (feed, search, notifications, profile actions) and removes follows in both directions. **Report** lets any logged-in user flag a post as inappropriate, creating an `OPEN` record in the database for future admin review (Phase 12).

---

## Prerequisites Applied

```bash
npx prisma migrate dev --name add_block_report \
  --schema=apps/backend/prisma/schema.prisma
```

---

## Backend

### Schema changes

**File:** `apps/backend/prisma/schema.prisma`

New enum and two new models:

```prisma
model Block {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())

  blockerId String
  blockedId String

  blocker User @relation("BlockerUser", fields: [blockerId], references: [id])
  blocked User @relation("BlockedUser", fields: [blockedId], references: [id])

  @@unique([blockerId, blockedId])
}

enum ReportStatus {
  OPEN
  CLOSED
}

model Report {
  id        Int          @id @default(autoincrement())
  createdAt DateTime     @default(now())
  reason    String
  status    ReportStatus @default(OPEN)

  reporterId String
  postId     Int

  reporter User @relation(fields: [reporterId], references: [id])
  post     Post @relation(fields: [postId], references: [id])
}
```

`User` gains `blockerRelations Block[] @relation("BlockerUser")`, `blockedRelations Block[] @relation("BlockedUser")`, and `reports Report[]`.  
`Post` gains `reports Report[]`.

Migration file: `apps/backend/prisma/migrations/20260429062512_add_block_report/migration.sql`

---

### Extended: `UsersModule`

**File:** `apps/backend/src/users/users.service.ts`

| Method | Description |
|--------|-------------|
| `toggleBlock(blockerId, blockedId)` | Finds existing block → deletes it (unblock). No existing block → creates it and runs `follow.deleteMany` for both directions in `Promise.all`. Returns `{ blocked: bool }`. |
| `findByUsername` | Now accepts `currentUserId?`. Adds an `isBlocked` boolean field to the return value by querying `block.findFirst` for either direction of a block between the two users. |

**File:** `apps/backend/src/users/users.controller.ts`

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `toggleBlock` | `POST /api/users/:id/block` | `JwtAuthGuard` | Toggle block; declared before `:id/follow` |

---

### Extended: `PostsModule`

**File:** `apps/backend/src/posts/posts.service.ts`

| Method | Description |
|--------|-------------|
| `createReport(reporterId, postId, reason)` | Creates a `Report` row with `status: 'OPEN'`. |
| `findAllReports()` | Returns all `OPEN` reports with reporter username and post snippet. Phase 12 will add role-based access. |
| `findAll` | Fetches all Block rows involving `userId` at the start of the method; builds a `blockedIds` array; adds `userId: { notIn: blockedIds }` to the `whereCondition` for home, explore, and guest feeds. Profile feeds (`?user=<username>`) are intentionally not filtered — a user can view their own profile. |

**File:** `apps/backend/src/posts/posts.controller.ts`

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `getReports` | `GET /api/posts/admin/reports` | `JwtAuthGuard` | Admin report queue (role guard added in Phase 12); declared before `GET :id` |
| `createReport` | `POST /api/posts/:id/report` | `JwtAuthGuard` | Body `{ reason: string }`; returns 201 |

---

### Extended: `SearchModule`

**File:** `apps/backend/src/search/search.service.ts`

When `userId` is provided, fetches Block rows and adds:
- `userId: { notIn: blockedIds }` to the posts query
- `id: { notIn: blockedIds }` to the users query

Hashtag results are not filtered (hashtags are not owned by users).

---

### Extended: `NotificationsModule`

**File:** `apps/backend/src/notifications/notifications.service.ts`

`findAll` fetches Block rows for `userId` and adds `actorId: { notIn: blockedIds }` to the notification query, preventing notifications from blocked users from appearing in the list.

---

## Frontend

### Updated: `PostInfo.tsx`

**File:** `apps/frontend/src/components/PostInfo.tsx`

Previously rendered a static non-interactive icon for non-owners. Now:
- **Non-owner, not logged in**: still renders the static icon (unchanged).
- **Non-owner, logged in**: renders a clickable icon that toggles a dropdown with a **"Report post"** button. Fires `POST /api/posts/:id/report` with `{ reason: "Other" }`. Button shows "Reporting…" while pending.

---

### New: `UserActions.tsx`

**File:** `apps/frontend/src/components/UserActions.tsx`

Client component rendered on other users' profiles. Replaces the static "more" icon + separate `FollowButton` in the profile header.

| Feature | Detail |
|---------|--------|
| "More" button | Renders a clickable icon that toggles a dropdown |
| Block option | Dropdown shows "Block @username" or "Unblock @username"; fires `POST /api/users/:id/block`; optimistic toggle with rollback on error |
| Cache invalidation | `queryClient.invalidateQueries({ queryKey: ["posts"] })` on block success — blocked user's posts disappear from any open feed immediately |
| Follow button | Rendered below the dropdown, hidden when `blocked = true` |

---

### Updated: `[username]/page.tsx`

**File:** `apps/frontend/src/app/(board)/[username]/page.tsx`

- Imports `UserActions` instead of `FollowButton`.
- The static "more" `<div>` is removed.
- When `userId` is set **and** viewing another user's profile (`userId !== user.id`), renders `<UserActions userId={user.id} isFollowed={!!user.followings.length} isBlocked={user.isBlocked ?? false} username={username} />`.
- Viewing your own profile: no block/follow actions rendered (same as before).

---

## Use Cases Delivered

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-U-SG-02 | Block / unblock a user; content hidden bidirectionally | ✅ |
| UC-U-PM-05 | Report a post; creates an OPEN Report row | ✅ |

---

## Phase 7 Exit Checklist

- [x] After A blocks B: B's posts/replies are absent from A's home, explore, and search feeds; and vice-versa.
- [x] Blocking removes Follow rows in both directions.
- [x] Notifications from a blocked user are filtered out of the recipient's notification list.
- [x] Unblocking restores content visibility (follows are not restored automatically — users must re-follow).
- [x] Reporting a post creates an `OPEN` `Report` row in the database.
- [x] Block option appears on other users' profiles; not on your own profile.
- [x] Report option appears on posts owned by other logged-in users; not on your own posts.
- [x] `GET /api/posts/admin/reports` returns all open reports.
- [x] `npm run build -w @breadit/backend` — clean.
- [x] `npm run typecheck -w @breadit/frontend` — clean.
- [x] `npm run lint -w @breadit/frontend` — warnings only (all pre-existing).
