# Phase 8 — Profile Editing Polish

## What Was Implemented

Phase 8 lets logged-in users edit their own profile. From their profile page they can update their avatar, cover image, display name, bio, location, job, and website. Images are uploaded through the existing `POST /api/uploads` endpoint (introduced in Phase 3); text fields are updated via a new `PATCH /api/users/me` REST endpoint. The edit modal opens inline — no page navigation required — and the profile re-renders automatically on save via Next.js `router.refresh()`.

Username is intentionally not editable (locked at registration to avoid broken permalink history).

---

## Prerequisites Applied

No database migration required — the `cover` column already existed on the `User` table from the initial schema.

---

## Backend

### No schema changes

All required columns (`displayName`, `bio`, `location`, `job`, `website`, `img`, `cover`) were present in the initial migration. `cover` is the field name (the implementation plan doc incorrectly called it `coverImg`).

---

### New: `UpdateUserDto`

**File:** `apps/backend/src/users/dto/update-user.dto.ts`

```ts
export class UpdateUserDto {
  displayName?: string;
  bio?: string;
  location?: string;
  job?: string;
  website?: string;
  img?: string;    // bare filename from POST /api/uploads (imgType=square)
  cover?: string;  // bare filename from POST /api/uploads (imgType=wide)
}
```

All fields optional. The client uploads images first and passes the returned filename as `img` / `cover`.

---

### Extended: `UsersModule`

**File:** `apps/backend/src/users/users.service.ts`

| Method | Description |
|--------|-------------|
| `updateProfile(userId, dto)` | Applies only the fields present in `dto` (sparse update via conditional spread). Selects back the updated record with all profile fields. Returns the updated user. |

**File:** `apps/backend/src/users/users.controller.ts`

| Method | Route | Guard | Description |
|--------|-------|-------|-------------|
| `updateProfile` | `PATCH /api/users/me` | `JwtAuthGuard` | Placed before the `/:username` GET route to avoid route collision. Returns the full updated user object. |

---

### Extended: `AuthModule`

**File:** `apps/backend/src/auth/auth.service.ts`

`me()` extended to select additional fields so `GET /api/auth/me` — used by the server-side session — reflects the latest profile state after an edit:

```ts
select: {
  id: true, username: true, email: true, emailVerified: true,
  img: true, displayName: true, bio: true, location: true,
  job: true, website: true, cover: true,
}
```

---

## Frontend

### Updated: `session.ts`

**File:** `apps/frontend/src/lib/session.ts`

`SessionUser` type extended to include the new fields returned by `GET /api/auth/me`:

```ts
export type SessionUser = {
  id: string;
  username: string;
  email: string;
  emailVerified: string | null;
  img?: string | null;
  displayName?: string | null;
  bio?: string | null;
  location?: string | null;
  job?: string | null;
  website?: string | null;
  cover?: string | null;
};
```

---

### New: `EditProfileModal.tsx`

**File:** `apps/frontend/src/components/EditProfileModal.tsx`

Client component rendered inside a full-screen backdrop overlay. Pre-fills all fields from the current `SessionUser`.

| Feature | Detail |
|---------|--------|
| Cover image | Clickable cover strip; clicking opens a hidden file input; local preview via `URL.createObjectURL` |
| Avatar | Clickable circle below the cover; same file-input pattern |
| Text fields | Name (50 chars), Bio (160 chars, textarea), Location (30 chars), Job (60 chars), Website (100 chars) |
| Save flow | Uploads avatar → uploads cover (only if changed) → `PATCH /api/users/me` with filenames + text fields |
| On success | `router.refresh()` triggers Next.js server-component re-render; modal closes |
| Error display | Upload or PATCH failure shown as inline red text |
| Dismiss | Click outside the modal card or the ✕ button; no save occurs |

Upload call pattern (reuses `apiMultipart` from Phase 3):

```ts
const fd = new FormData();
fd.append('file', file);
fd.append('imgType', 'square');   // or 'wide' for cover
const res = await apiMultipart('/api/uploads', fd);
const { filename } = await res.json();
```

PATCH call pattern (reuses `api` from Phase 4):

```ts
await api('/api/users/me', {
  method: 'PATCH',
  body: JSON.stringify({ displayName, bio, location, job, website, img?, cover? }),
});
```

---

### New: `EditProfileButton.tsx`

**File:** `apps/frontend/src/components/EditProfileButton.tsx`

Thin client component that owns modal open/close state. Renders the "Edit profile" pill button and, when open, mounts `<EditProfileModal>`. Kept separate from the server-rendered profile page so `useState` stays in a client component.

---

### Updated: `[username]/page.tsx`

**File:** `apps/frontend/src/app/(board)/[username]/page.tsx`

The action row now branches on whether the viewer is viewing their own profile:

| Condition | Renders |
|-----------|---------|
| Logged in and `userId === user.id` | `<EditProfileButton user={session.user} />` |
| Logged in and `userId !== user.id` | `<UserActions .../>` (block/follow — unchanged from Phase 7) |
| Guest | Neither button |

---

## Use Cases Delivered

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-U-PR-01 | Edit own profile (avatar, cover, name, bio, location, job, website) | ✅ |

---

## Phase 8 Exit Checklist

- [x] "Edit profile" button visible on own profile page; not visible on other profiles or for guests.
- [x] Edit modal pre-fills all existing profile values.
- [x] Updating text fields persists and renders on next visit.
- [x] Uploading a new avatar: resized to 600×600 JPEG; saved; profile header updates after save.
- [x] Uploading a new cover: resized to 600×338 JPEG; saved; profile cover updates after save.
- [x] If only text fields change (no new images), no upload requests are made.
- [x] Closing the modal without saving makes no changes.
- [x] `PATCH /api/users/me` returns 401 for unauthenticated requests.
- [x] `npm run build -w @breadit/backend` — clean.
- [x] `npm run typecheck` — clean (frontend + backend).
- [x] `npm run lint -w @breadit/frontend` — warnings only (all pre-existing).
