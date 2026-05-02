# Phase 6 — Persisted Notifications & Mentions

## What Was Implemented

Phase 6 makes notifications survive page reloads. Every interaction event (like, repost, reply, follow, mention) now writes a `Notification` row to the database. The bell badge in the sidebar shows a live unread count fetched from the API and incremented in real time via Socket.IO. A dedicated `/notifications` page lists all items and supports one-by-one and bulk mark-as-read. Typing `@username` in a post body creates a `MENTION` notification for each mentioned user.

---

## Prerequisites Applied

```bash
npm install timeago.js react-infinite-scroll-component \
  -w @breadit/frontend --legacy-peer-deps

npm run build -w @breadit/shared

npx prisma migrate dev --name add_notification \
  --schema=apps/backend/prisma/schema.prisma
```

---

## Backend

### Schema changes

**File:** `apps/backend/prisma/schema.prisma`

New enum and model:

```prisma
enum NotificationType {
  LIKE
  REPLY
  REPOST
  FOLLOW
  MENTION
}

model Notification {
  id          Int              @id @default(autoincrement())
  type        NotificationType
  recipientId String
  actorId     String
  postId      Int?
  readAt      DateTime?
  createdAt   DateTime         @default(now())

  recipient User  @relation("ReceivedNotifications", fields: [recipientId], references: [id])
  actor     User  @relation("SentNotifications",     fields: [actorId],     references: [id])
  post      Post? @relation(fields: [postId], references: [id])
}
```

`User` gains two back-relations: `receivedNotifications` and `sentNotifications`.  
`Post` gains `notifications Notification[]`.

Migration file: `apps/backend/prisma/migrations/20260429055535_add_notification/migration.sql`

---

### Updated: `NotificationsModule`

Phase 5 created the gateway; Phase 6 adds a service, controller, and exports the service so other modules can emit notifications.

| File | Purpose |
|------|---------|
| `apps/backend/src/notifications/notifications.service.ts` | Persists rows; pushes socket events; reads + marks-read |
| `apps/backend/src/notifications/notifications.controller.ts` | REST endpoints for the frontend |
| `apps/backend/src/notifications/notifications.module.ts` | Updated — now exports `NotificationsService` |

#### `NotificationsService`

| Method | Description |
|--------|-------------|
| `emit(type, actorId, recipientId, postId?)` | Skips if `actorId === recipientId`. Creates a `Notification` row, then pushes `getNotification` to the recipient's Socket.IO room. |
| `findAll(userId, cursor, unread)` | Returns `{ items, nextCursor, total }`. PAGE_SIZE = 20. When `unread = true`, filters `readAt: null`. |
| `markRead(userId, notifId)` | `updateMany` with `recipientId` guard (prevents marking another user's notifications). |
| `markAllRead(userId)` | Marks all unread notifications for `userId`; returns `{ count }`. |

#### `NotificationsController` — `@Controller('api/notifications')`

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `findAll` | `GET /api/notifications?cursor=&unread=` | `JwtAuthGuard` | Paginated list |
| `markAllRead` | `PATCH /api/notifications/read-all` | `JwtAuthGuard` | Bulk mark-read (static segment declared before `:id`) |
| `markRead` | `PATCH /api/notifications/:id/read` | `JwtAuthGuard` | Single mark-read |

---

### Extended: `InteractionsModule`

**File:** `apps/backend/src/interactions/interactions.service.ts`

`NotificationsService` injected. Notification emits added:
- `toggleLike` → `emit('LIKE', userId, post.userId, postId)` when a new Like row is created.
- `toggleRepost` → `emit('REPOST', userId, originalPost.userId, rePostId)` when a new repost is created (both plain and quote).

**File:** `apps/backend/src/interactions/interactions.module.ts`

Added `imports: [NotificationsModule]`.

---

### Extended: `UsersModule`

**File:** `apps/backend/src/users/users.service.ts`

`NotificationsService` injected. `toggleFollow` emits `emit('FOLLOW', followerId, followingId)` after creating the Follow row.

**File:** `apps/backend/src/users/users.module.ts`

Added `imports: [NotificationsModule]`.

---

### Extended: `PostsModule`

**File:** `apps/backend/src/posts/posts.service.ts`

Two new emission sites in `create()`:

1. **Reply notification** — if `parentPostId` is set, looks up the parent post's `userId` and emits `emit('REPLY', actorId, parentPost.userId, parentPostId)`.
2. **Mention notification** — extracts `@username` tokens from `desc` via `/@([a-zA-Z0-9_]+)/g`, deduplicates, looks up matching `User` rows, emits `emit('MENTION', actorId, mentionedUser.id, post.id)` for each. Both emissions are fire-and-forget (`void Promise.all(...)`).

**File:** `apps/backend/src/posts/posts.module.ts`

Added `NotificationsModule` to `imports` alongside `UploadsModule`.

---

## Shared types

**File:** `packages/shared/src/index.ts`

Added:

```typescript
export type NotificationType = 'LIKE' | 'REPLY' | 'REPOST' | 'FOLLOW' | 'MENTION';

export type NotificationItem = {
  id: number;
  type: NotificationType;
  readAt: string | null;
  createdAt: string;
  actor: { id: string; username: string; displayName: string | null; img: string | null };
  post: { id: number; user: { username: string } } | null;
};
```

---

## Frontend

### Rewritten: `Notification.tsx`

**File:** `apps/frontend/src/components/Notification.tsx`

Completely rewritten as a bell badge `<Link href="/notifications">`. On mount:
1. Fetches `GET /api/notifications?unread=true&cursor=1` → sets `unreadCount` from `data.total`.
2. Registers `socket.on('getNotification', handler)` → increments `unreadCount` by 1 on each incoming event.

Renders a blue dot badge (`bg-iconBlue`) when `unreadCount > 0`. Displays `"99+"` if count exceeds 99.

---

### Updated: `LeftBar.tsx`

**File:** `apps/frontend/src/components/LeftBar.tsx`

The Notifications menu item (id = 3, `link = "/notifications"`) now renders `<Notification />` for authenticated users instead of a plain link. Non-authenticated users see the plain link.

---

### New: `NotificationsFeed.tsx`

**File:** `apps/frontend/src/components/NotificationsFeed.tsx`

Client component. Uses `useInfiniteQuery(['notifications'])` with SSR `initialData` (page 1 fetched server-side).

| Feature | Detail |
|---------|--------|
| Pagination | `react-infinite-scroll-component`; appends pages as user scrolls |
| Mark-read on click | `PATCH /api/notifications/:id/read` fired when item has no `readAt`; then navigates to `notifLink(n)` |
| Bulk mark-read | "Mark all as read" button calls `PATCH /api/notifications/read-all`; invalidates `["notifications"]` query |
| Unread highlight | Unread items: `bg-[#0d1926]` background + blue dot indicator |
| Notification text | Helper `notifText(type)` → e.g. "liked your post", "followed you" |
| Navigation | Helper `notifLink(n)` → FOLLOW links to actor profile; others link to post permalink |
| Relative time | `timeago.js` `format(n.createdAt)` |

---

### New: `/notifications` page

**File:** `apps/frontend/src/app/(board)/notifications/page.tsx`

Server component. Redirects unauthenticated users to `/sign-in`. Fetches page 1 via `serverFetch('/api/notifications?cursor=1')` and passes result as `initialData` to `<NotificationsFeed>`.

---

## Use Cases Delivered

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-U-PM-01-ext-c | `@mention` in post body creates a MENTION notification | ✅ |
| UC-U-NT-01 | Like/repost/reply/follow events persist as Notification rows | ✅ |
| UC-U-NT-02 | Bell badge shows live unread count | ✅ |
| UC-U-NT-03 | `/notifications` page lists all notifications | ✅ |
| UC-U-NT-04 | Mark-as-read (single + bulk) | ✅ |

---

## Phase 6 Exit Checklist

- [x] Each like/reply/repost/follow/mention creates exactly one DB row.
- [x] Bell badge shows correct unread count on page load and increments in real time via socket.
- [x] `/notifications` page lists items; clicking an item marks it read and navigates to the relevant post or profile.
- [x] "Mark all as read" sets all `readAt` and refreshes the list.
- [x] `@username` in a post body creates a MENTION notification visible in real time and after reload.
- [x] Self-notifications are suppressed (`actorId === recipientId` guard).
- [x] `npm run build -w @breadit/backend` — clean.
- [x] `npm run typecheck -w @breadit/frontend` — clean.
- [x] `npm run lint -w @breadit/frontend` — warnings only (all pre-existing).
