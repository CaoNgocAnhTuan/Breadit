# Phase 3 — Core Posting & Media

## What Was Implemented

Phase 3 lets verified users create posts with optional image/video and soft-delete their own posts. It also migrates the last post-creation server action to a TanStack Query mutation and fixes the URL resolution for backend-uploaded media.

---

## Prerequisites Applied

```bash
npm install sharp @fastify/static -w @breadit/backend
npx prisma migrate dev --name add-post-deleted-at \
  --schema=apps/backend/prisma/schema.prisma
```

---

## Backend

### Schema change

**File:** `apps/backend/prisma/schema.prisma`

Added `deletedAt DateTime?` to the `Post` model. All feed, profile-tab, and permalink queries now filter `deletedAt: null` so soft-deleted posts are invisible everywhere.

Migration file created: `apps/backend/prisma/migrations/20260428041727_add_post_deleted_at/migration.sql`

---

### Static file serving

**File:** `apps/backend/src/main.ts`

Registered `@fastify/static` pointing at `UPLOAD_DIR` (env var, default `/var/lib/breadit/uploads`). The directory is created synchronously at startup if it doesn't exist. All uploaded files are publicly readable at `GET /uploads/<filename>` — no auth required (security via UUID filenames).

---

### New: `UploadsModule`

| File | Purpose |
|------|---------|
| `apps/backend/src/uploads/uploads.service.ts` | Sharp pipeline + file write |
| `apps/backend/src/uploads/uploads.controller.ts` | `POST /api/uploads` HTTP handler |
| `apps/backend/src/uploads/uploads.module.ts` | Module — exports `UploadsService` |

**`UploadsService.saveFile(file, imgType?)`** — the core image pipeline:

| `imgType` | Sharp operation | Output |
|-----------|----------------|--------|
| `original` (default) | `.resize(600)` — width 600, aspect preserved | `<uuid>.jpg` |
| `square` | `.resize(600, 600, { fit: 'cover' })` | `<uuid>.jpg` |
| `wide` | `.resize(600, 338, { fit: 'cover' })` | `<uuid>.jpg` |
| video | stream directly to disk, preserve extension | `<uuid>.<ext>` |

All images re-encoded as JPEG quality 80. Returns the bare filename (e.g. `abc123.jpg`).

`UploadsModule` exports `UploadsService` so `PostsModule` can inject it.

---

### Extended: `PostsModule`

**File:** `apps/backend/src/posts/posts.service.ts`

- **`create(userId, body, file?)`** — builds a post row; if a file is attached, calls `UploadsService.saveFile()` first and stores the returned filename in `Post.img`.
- **`remove(postId, userId)`** — asserts the row exists and `post.userId === userId`, then sets `deletedAt = new Date()` (soft delete). Throws 404 or 403 otherwise.
- All existing `findAll()` and `findOne()` queries updated to include `deletedAt: null`.

**File:** `apps/backend/src/posts/posts.controller.ts`

- Changed from controller-level `@UseGuards(OptionalJwtAuthGuard)` to per-handler guards so create/delete can require full auth.
- `POST /api/posts` — parses multipart parts manually via `req.parts()`, coerces numeric fields, then calls `postsService.create()`.
- `DELETE /api/posts/:id` — calls `postsService.remove()`.

**File:** `apps/backend/src/posts/posts.module.ts` — imports `UploadsModule`.

**File:** `apps/backend/src/app.module.ts` — imports `UploadsModule`.

**File:** `apps/backend/src/users/users.service.ts` — `getPostsByTab()` now includes `deletedAt: null` in all four tab where-conditions.

---

## Frontend

### Bug fix: `QueryProvider`

**File:** `apps/frontend/src/providers/QueryProvider.tsx`

Was creating `new QueryClient()` on every render, destroying the cache continuously. Fixed with `useState(() => new QueryClient())` so the client is created once per mount.

---

### New: `apiMultipart` helper

**File:** `apps/frontend/src/lib/api.ts`

Added `apiMultipart(path, body: FormData)` — identical to `api()` but omits `Content-Type` so the browser sets `multipart/form-data` with the correct boundary automatically. Used for all file-upload requests.

---

### Migrated: `Share.tsx`

**File:** `apps/frontend/src/components/Share.tsx`

Replaced `useActionState(addPost, ...)` + `<form action={...}>` with a `useMutation` hook:

- `mutationFn` builds `FormData` from the desc ref, `settings.type`, optional media file, then calls `apiMultipart('/api/posts', formData)`.
- `onSuccess` calls `queryClient.invalidateQueries({ queryKey: ['posts'] })` and resets desc/media/settings.
- `onError` sets local error state.
- Submit button triggers `mutation.mutate()` directly; `disabled` during `mutation.isPending`.

---

### Wired: compose modal

**File:** `apps/frontend/src/app/(board)/@modal/compose/post/page.tsx`

Was a static shell. Now renders `<Share />` inside the modal wrapper. The backdrop + X close button (calls `router.back()`) are kept; the center content is fully replaced by the functional compose component.

---

### New: delete button in `PostInfo`

**File:** `apps/frontend/src/components/PostInfo.tsx`

Transformed from a static icon to a `"use client"` component with props `postId: number` and `postUserId: string`:

- Reads current user from `useSession()`.
- **Non-owner**: renders the original static icon (no menu).
- **Owner**: clicking the icon opens a dropdown with a "Delete post" button.
  - `useMutation` calls `DELETE /api/posts/:id`.
  - `onMutate`: optimistic update — filters the post out of the `['posts']` infinite query cache via `queryClient.setQueryData`; captures previous data for rollback.
  - `onError`: restores previous cache data.
  - `onSettled`: invalidates both `['posts']` and `['profile-posts']` queries.

**File:** `apps/frontend/src/components/Post.tsx`

Updated `<PostInfo />` call to pass `postId={originalPost.id}` and `postUserId={originalPost.userId}`.

---

### Fixed: `Image.tsx` and `Video.tsx` URL resolution

**File:** `apps/frontend/src/components/Image.tsx`
**File:** `apps/frontend/src/components/Video.tsx`

**Old behavior:** any path without a leading `/` got one prepended (e.g. `general/noAvatar.png` → `/general/noAvatar.png`). This broke for backend-uploaded files which are stored as bare UUIDs like `abc123.jpg`.

**New detection rule:**
- Path contains `/` → local Next.js static asset → prepend `/` if needed.
- Path has no `/` → backend-uploaded file → prepend `${NEXT_PUBLIC_BACKEND_URL}/uploads/`.

Backend-uploaded images and videos now resolve to e.g. `http://localhost:4000/uploads/abc123.jpg`.

---

### Removed: `addPost` server action

**File:** `apps/frontend/src/action.ts`

`addPost` function deleted. The unused `z` import was also removed. All remaining server actions (`followUser`, `likePost`, `rePost`, `savePost`, `addComment`) are untouched — they will be migrated in Phase 4.

---

## Use Cases Delivered

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-U-PM-01 | Verified user creates a text post | ✅ |
| UC-U-PM-01-ext-a | Post with image (resized, re-encoded JPEG) | ✅ |
| UC-U-PM-01-ext-a | Post with video (stored as-is) | ✅ |
| UC-U-PM-03 | Author soft-deletes own post | ✅ |

---

## Phase 3 Exit Checklist

- [x] `POST /api/uploads` with JPEG → resized, re-encoded, served at `/uploads/<uuid>.jpg`.
- [x] `POST /api/posts` text-only → appears in feed.
- [x] `POST /api/posts` with image → image rendered via backend URL.
- [x] `POST /api/posts` with `imgType=square` or `wide` → correct crop.
- [x] `POST /api/posts` with video → stored as-is, plays in feed.
- [x] Unverified user hits `POST /api/posts` → 403.
- [x] Owner sees "Delete post" option; deletes → optimistic removal from feed; `deletedAt` set in DB.
- [x] Deleted post absent from feed, profile tabs, permalink.
- [x] Compose modal renders `<Share />` and posts successfully.
- [x] `npm run typecheck` — clean.
- [x] `npm run lint -w @breadit/frontend` — clean (warnings are pre-existing).
