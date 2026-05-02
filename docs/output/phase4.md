# Phase 4 — Interactions

## What Was Implemented

Phase 4 wires all social interactions end-to-end: like, save, repost, quote-repost, reply, share link, and follow/unfollow. Every remaining Next.js Server Action in `action.ts` is replaced by a TanStack Query `useMutation`, and `action.ts` is deleted.

---

## Prerequisites Applied

```bash
npx prisma migrate dev --name add_follow_notify \
  --schema=apps/backend/prisma/schema.prisma
```

---

## Backend

### Schema change

**File:** `apps/backend/prisma/schema.prisma`

Added `notify Boolean @default(false)` to the `Follow` model (UC-U-SG-01-ext-a — bell toggle on follow).

Migration file created: `apps/backend/prisma/migrations/20260428171032_add_follow_notify/migration.sql`

---

### New: `InteractionsModule`

| File | Purpose |
|------|---------|
| `apps/backend/src/interactions/interactions.service.ts` | Toggle business logic for like, save, repost |
| `apps/backend/src/interactions/interactions.controller.ts` | HTTP handlers for the three toggle endpoints |
| `apps/backend/src/interactions/interactions.module.ts` | Module registration |

**`InteractionsService` methods:**

| Method | Logic |
|--------|-------|
| `toggleLike(userId, postId)` | `findFirst` Like row; if found → `delete`; if not → `create`. Returns `{ liked: bool, count: number }`. |
| `toggleSave(userId, postId)` | Same pattern against `SavedPosts`. Returns `{ saved: bool }`. |
| `toggleRepost(userId, postId, desc?)` | **Plain** (no `desc`): find existing Post with `{ userId, rePostId: postId, desc: null, parentPostId: null, deletedAt: null }`; if found → soft-delete; if not → create. **Quote** (`desc` present): always creates a new Post with `rePostId` + `desc`, never toggles. Returns `{ reposted: bool, count: number }`. |

**`InteractionsController`** routes (all guarded by `JwtAuthGuard` + `EmailVerifiedGuard`):

```
POST /api/posts/:id/like    → 200 { liked, count }
POST /api/posts/:id/save    → 200 { saved }
POST /api/posts/:id/repost  → 200 { reposted, count }   body: { desc? }
```

`InteractionsModule` registered in `app.module.ts`. It relies on `PrismaService` via the global `PrismaModule` — no explicit import needed.

---

### Extended: `PostsModule`

**File:** `apps/backend/src/posts/posts.controller.ts`

Added `POST /api/posts/:id/comments` — creates a reply (a Post row with `parentPostId` forced to `:id`). Uses the same multipart parsing pattern as `POST /api/posts` (`for await ... req.parts()`). Delegates to the existing `PostsService.create()` with `parentPostId` injected, so all include/image logic is reused automatically.

Guards: `JwtAuthGuard` + `EmailVerifiedGuard`.

---

### Extended: `UsersModule`

**File:** `apps/backend/src/users/users.controller.ts`

Added `POST /api/users/:id/follow` — guarded by `JwtAuthGuard`. Accepts optional JSON body `{ notify?: boolean }` via `ToggleFollowDto` (class-validator). Delegates to `UsersService.toggleFollow()`.

**File:** `apps/backend/src/users/users.service.ts`

Added `toggleFollow(followerId, followingId, notify?)`:
- `findFirst` Follow row where `{ followerId, followingId }`.
- If found → `delete`; returns `{ following: false }`.
- If not → `create` with `notify: notify ?? false`; returns `{ following: true }`.

---

## Frontend

### Deleted: `action.ts`

**File:** `apps/frontend/src/action.ts` — **deleted entirely.**

All five server actions (`likePost`, `rePost`, `savePost`, `followUser`, `addComment`) are replaced by TanStack Query `useMutation`s. Zero remaining imports from this file.

---

### Rewritten: `PostInteractions.tsx`

**File:** `apps/frontend/src/components/PostInteractions.tsx`

`useOptimistic` + `<form action={...}>` replaced by three `useMutation` hooks, local `useState`, and plain button `onClick` handlers.

| Hook | Endpoint | Optimistic update |
|------|----------|-------------------|
| `likeMutation` | `POST /api/posts/:id/like` | Toggles `isLiked` + adjusts `likes` count immediately; rolls back on error; syncs from server response on success. |
| `saveMutation` | `POST /api/posts/:id/save` | Toggles `isSaved` immediately; rolls back on error. |
| `repostMutation` | `POST /api/posts/:id/repost` | For plain repost: toggles `isRePosted` + adjusts `rePosts` count. For quote-repost: only increments count on success (no pre-toggle). Rolls back on error. |

All three call `queryClient.invalidateQueries({ queryKey: ['posts'] })` on success.

Socket `sendNotification` events preserved: emitted in the click handler (like, plain repost) or in `onSuccess` (quote-repost).

Sign-in redirect: any interaction when `!user` pushes `/sign-in`.

**Repost UX:** clicking the repost icon opens `QuoteRepostModal`. Closing the modal or completing either action dismisses it.

**Share link (UC-U-PI-05):** clicking the upload icon calls `navigator.share({ url })` (native share sheet on mobile) with a `navigator.clipboard.writeText` fallback on desktop. The icon turns blue briefly to confirm the copy. No backend needed.

---

### New: `QuoteRepostModal.tsx`

**File:** `apps/frontend/src/components/QuoteRepostModal.tsx`

A fixed-position modal overlay with two actions:

- **"Repost" button** — calls `onRepost()` with no argument → plain repost (toggled).
- **Text input + "Quote" button** — calls `onRepost(desc)` with the typed text → quote-repost (always creates).

Clicking the backdrop closes the modal. Both buttons are disabled while `isPending`.

---

### Rewritten: `FollowButton.tsx`

**File:** `apps/frontend/src/components/FollowButton.tsx`

`useOptimistic` + `<form action={...}>` replaced by a single `useMutation`:

- `onMutate`: toggles local `following` state immediately (optimistic).
- `onSuccess`: syncs state from server response `{ following: bool }`; emits `sendNotification` socket event only when newly following.
- `onError`: rolls back local state.
- Button is `disabled` while `isPending`.

---

### Rewritten: `Comments.tsx`

**File:** `apps/frontend/src/components/Comments.tsx`

`useActionState(addComment, ...)` replaced by a `useMutation`:

- `mutationFn`: reads desc from a `useRef`, builds `FormData`, calls `apiMultipart('/api/posts/:id/comments', formData)`.
- `onSuccess`: clears the input, emits socket notification, invalidates `['posts']` query.
- `onError`: sets a local error string derived from the HTTP status code (401 → sign-in prompt, 403 → email-verify prompt, other → generic).

Hidden `<input name="postId" />` and `<input name="username" />` fields removed (no longer needed). The `postId` is now captured in the closure via the component prop.

---

## Use Cases Delivered

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-U-PI-01 | Like / unlike a post | ✅ |
| UC-U-PI-02 | Save / unsave a post | ✅ |
| UC-U-PI-03 | Plain repost (toggle) | ✅ |
| UC-U-PI-03-ext-a | Quote-repost with text | ✅ |
| UC-U-PI-04 | Reply / comment on a post | ✅ |
| UC-U-PI-05 | Share link (clipboard / native share) | ✅ |
| UC-U-SG-01 | Follow / unfollow a user | ✅ |
| UC-U-SG-01-ext-a | Follow with notification bell (`notify` flag) | ✅ |

---

## Phase 4 Exit Checklist

- [x] Like a post → counter increments immediately (optimistic); unlike → decrements.
- [x] Save a post → bookmark icon turns blue; unsave → clears.
- [x] Plain repost → `POST /api/posts/:id/repost {}` → repost count increments; clicking again soft-deletes and decrements.
- [x] Quote-repost → modal opens, text entered, "Quote" clicked → new Post created with `rePostId` + `desc`.
- [x] Reply → `POST /api/posts/:id/comments` → comment appears in permalink thread under parent post.
- [x] Share → URL copied to clipboard; share icon turns blue briefly to confirm.
- [x] Follow → `POST /api/users/:id/follow` → `{ following: true }`; follower count updates.
- [x] Unfollow → same endpoint → `{ following: false }`.
- [x] Unauthenticated user clicks any interaction → redirected to `/sign-in`.
- [x] `src/action.ts` deleted; `grep -r '"@/action"' apps/frontend/src` returns zero results.
- [x] `npm run typecheck` — clean (frontend + backend).
- [x] `npm run lint -w @breadit/frontend` — clean (warnings are pre-existing).
