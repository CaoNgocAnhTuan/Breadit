# Bugs Report & Fix Plan — Phase 8.5 (Round 2)

## Root-cause Summary

| # | Bug | Root cause | Files |
|---|---|---|---|
| 1 | Save button doesn't highlight | `invalidateQueries` races with optimistic state; save button not disabled during pending | `PostInteractions.tsx` |
| 2 | Bookmarks sidebar + page missing | No `/bookmarks` route; sidebar link still `/`; no backend endpoint for saved posts | `LeftBar.tsx`, new `bookmarks/page.tsx`, `users.*` |
| 3 | Notification bell badge stays after mark-all-read | `Notification.tsx` (bell) and `NotificationsFeed.tsx` are isolated — no shared signal | `Notification.tsx`, `NotificationsFeed.tsx` |
| 4 | Like / interactions silently fail | `JwtAuthGuard + EmailVerifiedGuard` returns 403 silently; `onError` reverts UI with no message | `PostInteractions.tsx` |
| 5 | Edit profile not updating | `router.push + router.refresh()` order races in Next.js; modal-slot refresh doesn't bust RSC payload | `EditProfileModal.tsx` |
| 6 | Recommendations not interactive | Hardcoded `<button>` Follow, `<Link href="/">` "Show More", no profile nav | `Recommendations.tsx` |
| 7 | Reply back arrow goes to home | Status page hard-codes `<Link href="/">` regardless of whether post is a reply | `[username]/status/[postId]/page.tsx`, `posts.service.ts` |
| 8 | Reply depth unlimited | No depth limit; replying to a reply creates ever-deeper threads | `Comments.tsx`, `Post.tsx` |

---

## Bug 1 — Save button doesn't highlight

**Root cause.**
`saveMutation.onSuccess` calls `queryClient.invalidateQueries({ queryKey: ["posts"] })`.
TanStack's prefix match invalidates the entire infinite feed, triggering a re-fetch from page 1.
During that re-fetch, some rapid re-renders can reset the optimistic state on the save icon before `data.saved` is committed to local `state`.
The save button also has no `disabled` during pending, so double-clicks fire two conflicting mutations.

**Fix — `apps/frontend/src/components/PostInteractions.tsx`**
1. Remove `queryClient.invalidateQueries(...)` from `saveMutation.onSuccess` (server state is already synced from `data.saved`).
2. Add `disabled={saveMutation.isPending}` to the save `<button>`.
3. Add visible error feedback in both `likeMutation.onError` and `saveMutation.onError`: if the error message is `"403"` show `"Please verify your email"`, otherwise show `"Something went wrong"`.

---

## Bug 2 — Bookmarks page & sidebar link

**Root cause.**
No bookmarks route exists; LeftBar `Bookmarks` item links to `"/"`.
Backend has no endpoint returning the current user's saved posts.

**Fix.**

**(a) Backend — `apps/backend/src/users/users.service.ts`**
Add method `getSavedPosts(userId, cursor)`:
```ts
async getSavedPosts(userId: string, cursor = 1) {
  const PAGE_SIZE = 10;
  const [rows, total] = await Promise.all([
    this.prisma.savedPosts.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      skip: (cursor - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        post: { include: postInclude(userId) }
      }
    }),
    this.prisma.savedPosts.count({ where: { userId } }),
  ]);
  return { posts: rows.map(r => r.post), hasMore: cursor * PAGE_SIZE < total };
}
```
> Note: `postInclude` is a private method in `PostsService` — move it to a shared helper, or duplicate the select object in `UsersService`, or call `postsService.postInclude(userId)` after injecting PostsService.

**(b) Backend — `apps/backend/src/users/users.controller.ts`**
Add route:
```ts
@Get('me/saved')
@UseGuards(JwtAuthGuard)
getSavedPosts(@Req() req: AuthedRequest, @Query('cursor') cursor: string) {
  return this.usersService.getSavedPosts(req.user!.id, parseInt(cursor ?? '1', 10));
}
```
> Add **above** the `@Get(':username')` route to avoid NestJS matching `me` as `:username`.

**(c) Frontend — new `apps/frontend/src/app/(board)/bookmarks/page.tsx`**
Server component: fetch `GET /api/users/me/saved?cursor=1`, display posts using the same `Post` component as the feed. Redirect to `/sign-in` if unauthenticated.

**(d) Frontend — `apps/frontend/src/components/LeftBar.tsx`**
Change `item.id === 5` (Bookmarks) to render `<Link href="/bookmarks">` when `user` exists.

---

## Bug 3 — Notification bell badge doesn't reset on mark-all-read

**Root cause.**
`Notification.tsx` (bell) has its own `unreadCount` React state; it never listens for "all read" events from `NotificationsFeed.tsx`.
`markAllRead` mutation in `NotificationsFeed` only invalidates `["notifications"]` — the bell query is a one-shot fetch in `useEffect`, not a React Query managed key.

**Fix.**
Use a lightweight custom DOM event as a cross-component signal.

**(a) `apps/frontend/src/components/NotificationsFeed.tsx`**
In `markAllRead.onSuccess`, add:
```ts
window.dispatchEvent(new CustomEvent('notifications:clear-badge'));
```

**(b) `apps/frontend/src/components/Notification.tsx`**
In `useEffect`, register listener:
```ts
const clearHandler = () => setUnreadCount(0);
window.addEventListener('notifications:clear-badge', clearHandler);
return () => {
  socket.off("getNotification", handler);
  window.removeEventListener('notifications:clear-badge', clearHandler);
};
```

Also: blue dot on individual notification row (`!n.readAt` bg) already disappears after `invalidateQueries` re-fetches with `readAt` set. ✓

---

## Bug 4 — Like / save / interactions silently fail (no user feedback)

**Root cause.**
All interaction endpoints require `JwtAuthGuard + EmailVerifiedGuard`. If a user has not verified their email, they get a 403. The current `onError` handler silently reverts the optimistic state with no visible error.

**Fix — `apps/frontend/src/components/PostInteractions.tsx`**
Add an `error` state and render it below the action bar.
```tsx
const [interactionError, setInteractionError] = useState<string | null>(null);
```
In each mutation's `onError`:
```ts
onError: (err: Error) => {
  // revert existing logic...
  if (err.message === "403") setInteractionError("Please verify your email to interact.");
  else setInteractionError("Something went wrong. Please try again.");
  setTimeout(() => setInteractionError(null), 3000);
},
```
Render below the actions row:
```tsx
{interactionError && <p className="text-red-400 text-xs mt-1">{interactionError}</p>}
```
This gives users actionable feedback instead of silent failure.

---

## Bug 5 — Edit profile changes not visible after save

**Root cause.**
`router.push(\`/${user.username}\`)` starts a client-side navigation; `router.refresh()` fires concurrently and may apply to the current modal slot, not the destination profile page. The `SessionProvider` value is set from the server layout; if the layout server component doesn't re-run, the profile page may still show stale data from the Next.js RSC cache.

**Fix — `apps/frontend/src/components/EditProfileModal.tsx`**
Replace `router.push + router.refresh()` with a full hard navigation:
```ts
onSuccess: () => {
  onClose();
  window.location.assign(`/${user.username}`);
},
```
`window.location.assign` performs a full browser page load: the session cookie is re-read, `/api/auth/me` re-fetched, and all server components (layout + profile page) re-render with fresh data. This guarantees the updated bio, avatar, and cover are visible immediately.

---

## Bug 6 — Recommendations not interactive

**Root cause.**
`Recommendations.tsx` is a server component. The user info area is not a link, and the Follow `<button>` has no handler.

**Fix — `apps/frontend/src/components/Recommendations.tsx`**

1. Wrap the avatar + name block in a `<Link href={\`/${person.username}\`}>`.
2. Change "Show More" `<Link href="/">` → `<Link href="/search?q=">` or a future `/explore` page. For now, `/search?q=people` is a good placeholder.
3. **Follow button**: The server component cannot hold mutation state. Extract a small `RecommendFollowButton` client component that wraps a `useMutation` calling `POST /api/users/${person.id}/follow`, with optimistic "Follow"/"Unfollow" toggle. This mirrors `FollowButton.tsx` — either reuse it directly or import `FollowButton` into `Recommendations`.

**Concrete change:**
Replace `<button className="...">Follow</button>` with:
```tsx
<FollowButton userId={person.id} isFollowed={false} username={person.username} />
```
And import `FollowButton` (already exists as a client component).

---

## Bug 7 — Reply back arrow navigates to home instead of parent post

**Root cause.**
`apps/frontend/src/app/(board)/[username]/status/[postId]/page.tsx` has `<Link href="/">` for the back arrow.
The backend `findOne` returns `parentPostId` (scalar, auto-included by Prisma) but NOT the parent post's author username.

**Fix.**

**(a) Backend — `apps/backend/src/posts/posts.service.ts`** `findOne`:
Add `parentPost` to the include:
```ts
include: {
  ...include,
  parentPost: {
    select: { id: true, user: { select: { username: true } } },
  },
  comments: { ... },
}
```

**(b) Frontend — `apps/frontend/src/app/(board)/[username]/status/[postId]/page.tsx`**
Compute back href:
```ts
const backHref = post.parentPost
  ? `/${post.parentPost.user.username}/status/${post.parentPostId}`
  : "/";
```
Change back link:
```tsx
<Link href={backHref}>
```

---

## Bug 8 — Reply depth unlimited (replies to replies create infinite nesting)

**Root cause.**
`Comments.tsx` renders a reply input regardless of nesting depth. A reply to a comment creates a post with `parentPostId = commentId`. Navigating to that sub-reply shows another reply input, and so on.

**User expectation**: allow only 1 level of reply (reply to original post). Replies to replies should still be attributed to the reply author but submit to the original top-level post.

**Fix.**

**(a) `apps/frontend/src/components/Comments.tsx`**
Add a `depth` prop (default `0`). When `depth >= 1`, replace the reply input with a note:
```tsx
<p className="text-textGray text-sm px-4 py-2">
  Reply to the original post above ↑
</p>
```
And render the comment list without nested `Comments` (they already aren't nested, but the comment icon click on each `Post` navigates to a status page which shows another `Comments` component).

**(b) `apps/frontend/src/app/(board)/[username]/status/[postId]/page.tsx`**
Pass `depth` to the `Comments` component based on whether the post IS a comment:
```tsx
<Comments
  comments={post.comments}
  postId={post.id}
  username={post.user.username}
  depth={post.parentPostId ? 1 : 0}
/>
```
This way:
- Status page for an original post: `depth=0` → reply input shown ✓
- Status page for a comment/reply: `depth=1` → reply input hidden; user sees "Reply to the original post" ✓

---

## Implementation order

1. Bug 5 (edit profile) — 1 line change, highest ROI
2. Bug 1 (save button) — 3-line change
3. Bug 3 (notification bell) — 2 components, tiny
4. Bug 4 (interaction error feedback) — adds trust
5. Bug 7 (back arrow) — 2 files, clear
6. Bug 8 (reply depth) — 2 files, clear
7. Bug 6 (recommendations) — moderate refactor
8. Bug 2 (bookmarks) — backend + frontend, largest

## Files modified / created

| File | Change |
|---|---|
| `apps/frontend/src/components/PostInteractions.tsx` | remove invalidate, add disabled, add error feedback |
| `apps/frontend/src/components/EditProfileModal.tsx` | `window.location.assign` |
| `apps/frontend/src/components/Notification.tsx` | listen for clear-badge event |
| `apps/frontend/src/components/NotificationsFeed.tsx` | dispatch clear-badge on markAllRead |
| `apps/frontend/src/components/Recommendations.tsx` | link cards, reuse FollowButton, fix Show More |
| `apps/frontend/src/components/LeftBar.tsx` | wire Bookmarks → /bookmarks |
| `apps/frontend/src/components/Comments.tsx` | add depth prop |
| `apps/frontend/src/app/(board)/[username]/status/[postId]/page.tsx` | smart back href, pass depth |
| `apps/frontend/src/app/(board)/bookmarks/page.tsx` | **new** |
| `apps/backend/src/users/users.service.ts` | add `getSavedPosts` |
| `apps/backend/src/users/users.controller.ts` | add `GET /api/users/me/saved` |
| `apps/backend/src/posts/posts.service.ts` | add `parentPost` to findOne include |

No changes to auth, JWT, or DB schema.
