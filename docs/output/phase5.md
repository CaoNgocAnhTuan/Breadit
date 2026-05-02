# Phase 5 — Socket.IO Migration + Discovery

## What Was Implemented

Phase 5 moves real-time notifications from the Next.js custom server (`server.js`) into a NestJS WebSocket gateway, deletes `server.js` entirely, and delivers three discovery features: hashtag pages, an explore feed, and full-text search.

---

## Prerequisites Applied

```bash
npm install @nestjs/websockets @nestjs/platform-socket.io socket.io @socket.io/redis-adapter \
  -w @breadit/backend --legacy-peer-deps

npx prisma migrate dev --name add_hashtags \
  --schema=apps/backend/prisma/schema.prisma
```

---

## Backend

### Schema changes

**File:** `apps/backend/prisma/schema.prisma`

Added two new models:

```prisma
model Hashtag {
  id        Int      @id @default(autoincrement())
  tag       String   @unique
  createdAt DateTime @default(now())
  posts     PostTag[]
}

model PostTag {
  postId    Int
  hashtagId Int
  post      Post    @relation(fields: [postId], references: [id])
  hashtag   Hashtag @relation(fields: [hashtagId], references: [id])
  @@id([postId, hashtagId])
}
```

`Post` gains a `tags PostTag[]` relation.

Migration file: `apps/backend/prisma/migrations/20260429041029_add_hashtags/migration.sql`

---

### New: `NotificationsModule`

| File | Purpose |
|------|---------|
| `apps/backend/src/notifications/notifications.gateway.ts` | WebSocket gateway |
| `apps/backend/src/notifications/notifications.module.ts` | Module registration |

**`NotificationsGateway`** — `@WebSocketGateway({ cors: { origin: FRONTEND_URL, credentials: true } })`

| Lifecycle / Event | Behavior |
|---|---|
| `handleConnection` | Parses `breadit_session` cookie from handshake headers; calls `verifyJwt()`; disconnects socket if missing or invalid. |
| `afterInit` | Creates a pub + sub `ioredis` connection from `REDIS_URL`; attaches `@socket.io/redis-adapter` to the server for multi-replica routing. |
| `newUser` | `socket.join(username)` — puts the socket in a room named by username. All `getNotification` events for that user are routed to this room. |
| `sendNotification` | `this.server.to(receiverUsername).emit('getNotification', { id: randomUUID(), ...data })` |

**Event contract** (identical to the old `server.js`):
- Client → server: `newUser(username)`, `sendNotification({ receiverUsername, data })`
- Server → client: `getNotification({ id, senderUsername, type, link })`

The room-based approach (replacing the in-memory array) works transparently with the Redis adapter: two backend replicas can each hold part of the connected sockets, and the adapter fans out messages between them.

---

### Updated: `main.ts`

**File:** `apps/backend/src/main.ts`

Added:
```typescript
import { IoAdapter } from '@nestjs/platform-socket.io';
// …
app.useWebSocketAdapter(new IoAdapter(app));
```

`IoAdapter` attaches Socket.IO to the same underlying HTTP server that Fastify uses (port 4000), so WebSocket and REST share a single port.

---

### New: `HashtagsModule`

| File | Purpose |
|------|---------|
| `apps/backend/src/hashtags/hashtags.service.ts` | `getPostsByTag(tag, cursor, userId?)` |
| `apps/backend/src/hashtags/hashtags.controller.ts` | `GET /api/hashtags/:tag/posts` |
| `apps/backend/src/hashtags/hashtags.module.ts` | Module |

`HashtagsService.getPostsByTag` normalises the tag to lowercase and queries:
```typescript
where: { deletedAt: null, tags: { some: { hashtag: { tag: normalized } } } }
```
Returns `{ posts, hasMore, tag }`. Guarded by `OptionalJwtAuthGuard`.

---

### New: `SearchModule`

| File | Purpose |
|------|---------|
| `apps/backend/src/search/search.service.ts` | Three parallel ILIKE queries |
| `apps/backend/src/search/search.controller.ts` | `GET /api/search?q=` |
| `apps/backend/src/search/search.module.ts` | Module |

`SearchService.search` runs three `prisma.findMany` calls in `Promise.all`:
- `Post.desc ILIKE %q%` — top-level, non-deleted; max 5
- `User.username ILIKE %q% OR User.displayName ILIKE %q%` — max 5
- `Hashtag.tag ILIKE %q%` — max 5

Returns `{ posts, users, hashtags }`. Empty string query short-circuits and returns empty arrays.

---

### Extended: `PostsModule`

**File:** `apps/backend/src/posts/posts.service.ts`

**Hashtag parsing in `create()`:** After inserting the Post row, extracts `#word` tokens from `desc` via `/#+([a-zA-Z0-9_]+)/g`, deduplicates (lowercased), then for each tag:
1. `prisma.hashtag.upsert({ where: { tag }, create: { tag }, update: {} })` — idempotent
2. `prisma.postTag.upsert(...)` — links post ↔ hashtag

**Explore feed in `findAll()`:** New `feed` parameter. When `feed === 'explore'`:
- `whereCondition = { parentPostId: null, deletedAt: null }` (all posts)
- `orderBy = [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }]`

**File:** `apps/backend/src/posts/posts.controller.ts`

Added `@Query('feed') feed` parameter, passed through to `postsService.findAll()`.

---

### Updated: `app.module.ts`

Registered `NotificationsModule`, `HashtagsModule`, `SearchModule`.

---

## Frontend

### Socket.IO client — `socket.ts`

**File:** `apps/frontend/src/socket.ts`

Changed from connecting to the Next.js origin (`io()`) to the backend:

```typescript
export const socket = io(
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:4000",
  { withCredentials: true }
);
```

`withCredentials: true` ensures the `breadit_session` cookie is sent in the Socket.IO handshake so the gateway can validate it.

---

### Deleted: `server.js`

**File:** `apps/frontend/server.js` — **deleted entirely.**

The custom Next.js + Socket.IO server is no longer needed. Socket.IO now runs on the backend.

---

### Updated: `package.json` + `Dockerfile`

**File:** `apps/frontend/package.json`

```json
"dev":   "next dev",
"start": "next start"
```

`socket.io` (server-side) removed from `dependencies`; `socket.io-client` kept.

**File:** `apps/frontend/Dockerfile`

```dockerfile
# Before:
COPY --from=builder /app/apps/frontend/server.js ./server.js
CMD ["node", "server.js"]

# After:
CMD ["node_modules/.bin/next", "start"]
```

The `server.js` COPY line is removed.

---

### New: `/hashtag/[tag]` page

**File:** `apps/frontend/src/app/(board)/hashtag/[tag]/page.tsx`

Client component (`"use client"` + `use(params)`). Uses `useInfiniteQuery` with:
- `queryKey: ["hashtag", tag]`
- `queryFn`: `GET /api/hashtags/:tag/posts?cursor=<n>`

Shows header `#<tag>`, paginated posts via `InfiniteScroll`, and an empty state message when no posts exist.

---

### Updated: Homepage — Explore tab

**File:** `apps/frontend/src/app/(board)/page.tsx`

Converted to `async` server component reading `searchParams.feed`. When `feed === 'explore'`, passes `feed="explore"` down to `<Feed />`:

```
"For you" → href="/"             → Feed feed={undefined}  (personalised)
"Explore" → href="/?feed=explore" → Feed feed="explore"    (all posts by like count)
```

Active tab highlighted with `border-b-4 border-iconBlue`.

**File:** `apps/frontend/src/components/Feed.tsx`

Added `feed?: string` prop; builds query string with `URLSearchParams`.

**File:** `apps/frontend/src/components/InfiniteFeed.tsx`

Added `feed?: string` prop; included in `queryKey` (so explore and for-you caches are separate) and in the fetch URL.

---

### Rewritten: `Search.tsx`

**File:** `apps/frontend/src/components/Search.tsx`

Converted from a static UI shell to a fully wired client component:

- **300ms debounce**: `useEffect` on `query` → fetch `GET /api/search?q=<query>` after 300ms idle.
- **Dropdown**: renders below the input when the query is non-empty and results are available.
  - **People** section: avatar + name + username; click → navigate to `/@username`.
  - **Hashtags** section: click → navigate to `/hashtag/<tag>`.
  - **Posts** section: click → navigate to `/<username>/status/<id>`.
- **Click-outside close**: `mousedown` listener on `document`, dismissed when clicking outside the container ref.

---

## Use Cases Delivered

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-U-PM-01-ext-b | Real-time notifications via backend WebSocket | ✅ |
| UC-U-FD-02 | Hashtag pages (`/hashtag/:tag`) | ✅ |
| UC-U-FD-03 | Explore feed (sorted by popularity) | ✅ |
| UC-U-FD-04 | Full-text search across posts, users, hashtags | ✅ |
| UC-G-04 | Guest can view explore feed and search | ✅ |

---

## Phase 5 Exit Checklist

- [x] Real-time notification delivered via backend WebSocket — `getNotification` received in browser when another user follows/likes.
- [x] `server.js` deleted; frontend starts with `next dev` / `next start`.
- [x] `socket.ts` connects to `NEXT_PUBLIC_BACKEND_URL`, not the Next.js origin.
- [x] Post with `#nestjs` in desc → `GET /api/hashtags/nestjs/posts` returns it → `/hashtag/nestjs` page shows it.
- [x] `GET /api/search?q=alice` returns matching users; `?q=nestjs` returns matching hashtags and posts.
- [x] Explore tab on homepage loads all posts sorted by like count.
- [x] `npm run typecheck` — clean (frontend + backend).
- [x] `npm run lint -w @breadit/frontend` — clean (warnings are pre-existing).
