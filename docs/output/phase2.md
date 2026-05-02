# Phase 2 — Read Paths & Profile Completeness

## What Was Implemented

Phase 2 completes all public read-only pages. The changes fall into three areas: backend endpoints for profile tab data and follower/following lists, frontend UI for profile tabs and list pages, and guest-gating for write CTAs.

---

## Backend

### New file / modified files

| File | Change |
|------|--------|
| `apps/backend/src/users/users.controller.ts` | Added 3 new GET handlers (profile posts, followers, following) |
| `apps/backend/src/users/users.service.ts` | Added `getPostsByTab`, `getFollowers`, `getFollowing`; added private `postInclude` helper |

### New endpoints

#### `GET /api/users/:username/posts?tab=posts|replies|media|likes&cursor=N`

Returns a paginated page of posts for a user profile tab.

- `tab=posts` (default) — top-level posts only (`parentPostId: null`)
- `tab=replies` — posts that are replies (`parentPostId: { not: null }`)
- `tab=media` — top-level posts that contain an image or video
- `tab=likes` — posts liked by this user (via the `Like` join table)
- Cursor is page-number based: `skip = (cursor - 1) * 3`, `take = 3`.
- Returns `{ posts: Post[], hasMore: boolean }`.
- Protected by `OptionalJwtAuthGuard` so engagement state (isLiked, isReposted, isSaved) is included for authenticated users.

#### `GET /api/users/:username/followers?cursor=N`

Returns a paginated list of users who follow the given username.
- `skip = (cursor - 1) * 10`, `take = 10`.
- Returns `{ users: UserSummary[], hasMore: boolean }` where each user has `id, username, displayName, img, bio`.

#### `GET /api/users/:username/following?cursor=N`

Same shape as the followers endpoint but returns users that the given username follows.

---

## Frontend

### New files

| File | Purpose |
|------|---------|
| `apps/frontend/src/components/ProfileTabFeed.tsx` | Client component — `useInfiniteQuery` on `/api/users/:username/posts?tab=...`; renders `Post` cards with infinite scroll. Query key `['profile-posts', username, tab]` ensures each tab has its own cache. |
| `apps/frontend/src/components/ProfileTabs.tsx` | Client component — tab bar (Posts / Replies / Media / Likes) with local `useState`. Renders `ProfileTabFeed` for the active tab. |
| `apps/frontend/src/components/UserCard.tsx` | Server-compatible component — displays avatar, display name, @username, bio snippet for a user. Used in follower/following lists. |
| `apps/frontend/src/components/UserList.tsx` | Client component — `useInfiniteQuery` on `/api/users/:username/followers` or `.../following`; hydrated with SSR initial data; renders `UserCard` rows with infinite scroll. |
| `apps/frontend/src/app/(board)/[username]/followers/page.tsx` | SSR page — fetches first page of followers via `serverFetch`, renders `UserList`. |
| `apps/frontend/src/app/(board)/[username]/following/page.tsx` | SSR page — same pattern for the following list. |

### Modified files

| File | Change |
|------|--------|
| `apps/frontend/src/app/(board)/[username]/page.tsx` | Replaced `<Feed userProfileId={...} />` with `<ProfileTabs username={username} />`; made follower/following counts clickable links to `/[username]/followers` and `/[username]/following`. |
| `apps/frontend/src/components/FollowButton.tsx` | For unauthenticated users: instead of returning `null`, renders a "Follow" button that redirects to `/sign-in` on click. |
| `apps/frontend/src/components/PostInteractions.tsx` | For unauthenticated users: like / repost / save actions now redirect to `/sign-in` instead of silently no-opping. |

---

## Use Cases Delivered

From the Phase 2 spec (`UC-G-01..04, UC-U-PR-02..04`):

| Use Case | Description | Status |
|----------|-------------|--------|
| UC-G-01 | Guest browses the public feed | ✅ Already done (Stage 4) |
| UC-G-02 | Guest views a user profile page | ✅ Already done (Stage 4); profile now shows tabs |
| UC-G-03 | Guest views a post permalink | ✅ Already done (Stage 4) |
| UC-G-04 | Guest sees a sign-in prompt on write CTAs | ✅ Implemented — like/repost/save/follow redirect to `/sign-in` |
| UC-U-PR-02 | Profile Posts tab | ✅ Implemented — `tab=posts` via `GET /api/users/:username/posts` |
| UC-U-PR-03 | Profile Replies / Media / Likes tabs | ✅ Implemented — `tab=replies|media|likes` on the same endpoint |
| UC-U-PR-04 | Followers and Following list pages | ✅ Implemented — `/[username]/followers` and `/[username]/following` with pagination |

---

## Phase 2 Exit Checklist

- [x] Logged-out user browses feed, profile, permalink — all SSR, no auth error.
- [x] Profile tabs (Posts / Replies / Media / Likes) each render the correct dataset.
- [x] Followers and following list pages render and paginate.
- [x] Guest clicking like / repost / save / follow is redirected to `/sign-in`.

---

## Verification

```bash
# TypeScript
npm run typecheck          # passes clean (both workspaces)

# Lint
npm run lint -w @breadit/frontend   # passes (only pre-existing warnings unrelated to Phase 2)

# Docker smoke test
docker compose up --build  # all 4 containers healthy
```

Manual smoke paths:
1. Visit `/[username]` as guest — profile loads; click each tab — correct posts appear; follower/following counts are clickable links.
2. Visit `/[username]/followers` — user list with avatar, name, bio renders.
3. Visit `/[username]/following` — same.
4. As guest, click Like on any post — redirected to `/sign-in`.
5. As guest, click Follow button on profile — redirected to `/sign-in`.
