# Implementation Plan — X Clone (Breadit)

> Companion to `docs/planning/usecase.md`.
> **Single source of truth** from Phase 2 onward. `docs/planning/divide_plan.md` stages 0–4 are done; stages 5–7 are folded into Phases 3–4, 5, and 9 respectively.
> Architecture: two-service npm workspace — `apps/frontend` (Next.js 15) + `apps/backend` (NestJS/Fastify). No NextAuth, no direct Prisma in frontend, no MySQL, no server actions after Phase 4.

---

## Phase Map (at a glance)

| Phase | Theme | Status | UCs delivered |
|---|---|---|---|
| **0** | Foundation hardening | ✅ done | — |
| **1** | Auth & onboarding | ✅ done | UC-G-05, UC-G-06, UC-E-01, UC-E-02 |
| **2** | Read paths & profile completeness | ✅ done | UC-G-01..04, UC-U-PR-02..04 |
| **3** | Core posting & media | ✅ done | UC-U-PM-01 (+ext-a), UC-U-PM-03 |
| **4** | Interactions | ✅ done | UC-U-PI-01..05, UC-U-SG-01 |
| **5** | Socket.IO migration + discovery | ✅ done | UC-U-PM-01-ext-b, UC-U-FD-02..04, UC-G-04 |
| **6** | Notifications (persisted) & mentions | ✅ done | UC-U-PM-01-ext-c, UC-U-NT-01..04 |
| **7** | Safety — Block & Report | ✅ done | UC-U-SG-02, UC-U-PM-05 |
| **8** | Profile editing polish | ✅ done | UC-U-PR-01 |
| **9** | v1 hardening & launch | ✅ done | (cross-cutting) |
| **10** | Direct messaging & Multi-media | ✅ done | UC-U-MG-01..02 |
| **11** | Communities | ✅ done | UC-U-CM-01..04, UC-M-01..05 |
| **12** | Admin console | ✅ done | UC-A-01..06 |
| **13** | Notification preferences & email digests | future | UC-U-NT-05, UC-E-03..04, UC-U-PM-02, UC-U-PM-04 |

---

## Phase 0 — Foundation Hardening ✅

Done: Husky + lint-staged pre-commit hook, typecheck script, ESLint flat config, `.env.example` with Resend keys.

---

## Phase 1 — Auth & Onboarding ✅  *(UC-G-05, UC-G-06, UC-E-01, UC-E-02)*

Done: NestJS `AuthModule` with JWT cookie (`breadit_session` httpOnly). Endpoints: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/verify`, `POST /api/auth/verify/resend`, `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`. NextAuth removed. Email sent via **nodemailer SMTP** (not Resend — architecture.md §4.2 still says Resend; SMTP is the actual implementation). Frontend reads session via `getSession()` → `GET /api/auth/me`.

---

## Phase 2 — Read Paths & Profile Completeness ✅  *(UC-G-01..04, UC-U-PR-02..04)*

Done:
- Public feed: `GET /api/posts?cursor=<n>&user=<username>`; `InfiniteFeed.tsx` with TanStack Query.
- User profile: `GET /api/users/:username`; SSR page at `app/(board)/[username]/page.tsx`.
- Post permalink: `GET /api/posts/:id`; SSR at `app/(board)/[username]/status/[postId]/page.tsx`.
- Profile tabs: `GET /api/users/:username/posts?tab=posts|replies|media|likes`.
- Followers / following: `GET /api/users/:username/followers` and `GET /api/users/:username/following` (paginated); pages at `[username]/followers` and `[username]/following`.
- Guest access: all pages SSR without a cookie.

---

## Phase 3 — Core Posting & Media ✅  *(UC-U-PM-01, ext-a, UC-U-PM-03)*

Done:
- `UploadsModule` — `POST /api/uploads`; multipart receive buffered into memory, sharp re-encodes images (600px/square/wide) as JPEG, videos stored as-is. `JwtAuthGuard` + `EmailVerifiedGuard`.
- `PostsModule.create` — `POST /api/posts`; multipart body `{ desc, imgType?, rePostId?, parentPostId?, isSensitive? }` + optional file. `JwtAuthGuard` + `EmailVerifiedGuard`.
- `PostsModule.remove` — `DELETE /api/posts/:id`; soft-delete (`deletedAt`).
- `Share.tsx` replaced `addPost` server action with TanStack Query `useMutation`; invalidates `["posts"]` on success.
- `Image.tsx` resolves bare filenames to `${NEXT_PUBLIC_BACKEND_URL}/uploads/<file>` and marks them `unoptimized` so Next.js does not proxy them through the frontend container.
- Global `AllExceptionsFilter` logs full stack on 500s.

**Schema:** `Post.deletedAt DateTime?`, `Post.isSensitive Boolean`.

---

## Phase 4 — Interactions ✅  *(UC-U-PI-01..05, UC-U-SG-01)*

Done:
- `InteractionsModule` — toggle endpoints guarded by `JwtAuthGuard` + `EmailVerifiedGuard`:
  - `POST /api/posts/:id/like` — toggles `Like` row; returns `{ liked: bool, count: number }`.
  - `POST /api/posts/:id/repost` — plain toggle or quote-repost (`{ desc? }`); returns `{ reposted: bool, count: number }`.
  - `POST /api/posts/:id/save` — toggles `SavedPosts` row; returns `{ saved: bool }`.
- `POST /api/posts/:id/comments` added to `PostsController` — multipart; creates `Post` with `parentPostId`. `JwtAuthGuard` + `EmailVerifiedGuard`.
- `POST /api/users/:id/follow` added to `UsersController` — toggles `Follow` row; returns `{ following: bool }`. Body `{ notify? }`. `JwtAuthGuard`.
- `PostInteractions.tsx` — three `useMutation` hooks (like/save/repost) with optimistic local state + rollback.
- `QuoteRepostModal.tsx` — new modal for plain repost vs. quote-repost.
- `FollowButton.tsx` — `useMutation` with optimistic toggle.
- `Comments.tsx` — `useMutation` via `apiMultipart`.
- Share link (UC-U-PI-05) — `navigator.share` / clipboard fallback in `PostInteractions`.
- `src/action.ts` deleted; no server actions remain.

**Schema:** `Follow.notify Boolean @default(false)`.

---

## Phase 5 — Socket.IO Migration + Discovery ✅  *(UC-U-PM-01-ext-b, UC-U-FD-02..04, UC-G-04)*

Done:
- `NotificationsModule` — `@WebSocketGateway` on port 4000 via `IoAdapter`; JWT cookie validated on connection; room-based routing (`socket.join(username)` → `server.to(username).emit('getNotification')`); `@socket.io/redis-adapter` for multi-replica.
- `HashtagsModule` — `GET /api/hashtags/:tag/posts` cursor-paginated; tag normalised to lowercase.
- `SearchModule` — `GET /api/search?q=` returns `{ posts, users, hashtags }` via parallel ILIKE queries (max 5 each).
- `PostsService.create` — parses `#hashtag` tokens, upserts `Hashtag` + `PostTag` rows.
- `PostsService.findAll` — `?feed=explore` orders by `likes._count desc` across all posts.
- `socket.ts` — connects to `NEXT_PUBLIC_BACKEND_URL` with `withCredentials: true`.
- `server.js` deleted; frontend starts with `next dev` / `next start`.
- `Dockerfile` CMD updated; `docker-compose.yml` `command` override removed.
- `/hashtag/[tag]` page — infinite-scroll feed for a single hashtag.
- Homepage — "For You" / "Explore" tabs via `?feed=explore` URL param.
- `Search.tsx` — debounced dropdown with People / Hashtags / Posts sections.
- `Makefile` — `frontend-rebuild`, `backend-rebuild`, `frontend-restart`, `backend-restart`, `frontend-clean`, `backend-clean`, `rebuild`, `clean`, `up`, `down`, `logs`.

**Schema:** `Hashtag { id, tag (unique), createdAt }`, `PostTag { postId, hashtagId, @@id([postId, hashtagId]) }`.

---

## Phase 6 — Persisted Notifications & Mentions ✅  *(UC-U-PM-01-ext-c, UC-U-NT-01..04)*

Done:
- `NotificationsService` — `emit(type, actorId, recipientId, postId?)` persists a `Notification` row and pushes `getNotification` to the recipient's Socket.IO room. Self-notifications suppressed (`actorId === recipientId` guard).
- `NotificationsController` — `GET /api/notifications?cursor=&unread=`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`. All guarded by `JwtAuthGuard`.
- `NotificationsModule` now exports `NotificationsService` so `InteractionsModule`, `UsersModule`, and `PostsModule` can inject it.
- `InteractionsModule` — emits `LIKE` on like create, `REPOST` on repost create.
- `UsersModule.toggleFollow` — emits `FOLLOW` after creating the Follow row.
- `PostsService.create` — emits `REPLY` to parent post owner; parses `@username` tokens and emits `MENTION` to each mentioned user (fire-and-forget).
- `Notification.tsx` badge — fetches unread count from `GET /api/notifications?unread=true` on mount; increments on `getNotification` socket event.
- `NotificationsFeed.tsx` — `useInfiniteQuery(['notifications'])` with SSR `initialData`; mark-read on click; "Mark all as read" button; unread highlight; `timeago.js` relative timestamps.
- `/notifications` SSR page — redirects guests; fetches page 1 via `serverFetch`; passes to `<NotificationsFeed>`.

**Schema:** `NotificationType ENUM(LIKE|REPLY|REPOST|FOLLOW|MENTION)`, `Notification { id, type, recipientId, actorId, postId?, readAt?, createdAt }`.

Migration: `apps/backend/prisma/migrations/20260429055535_add_notification/migration.sql`

**Exit checklist**
- [x] Each like/reply/repost/follow/mention creates exactly one DB row.
- [x] Bell badge shows correct unread count.
- [x] `/notifications` page lists items; clicking marks read.
- [x] "Mark all read" sets all `readAt`.
- [x] Mention `@username` in post → mentioned user gets notification in real time and on reload.

---

## Phase 7 — Safety: Block & Report ✅  *(UC-U-SG-02, UC-U-PM-05)*

Done:
- `UsersService.toggleBlock` — creates/deletes `Block` row; on block, removes `Follow` rows in both directions (`Promise.all`). Returns `{ blocked: bool }`.
- `UsersService.findByUsername` — now returns `isBlocked: boolean` when `currentUserId` is provided (checks both block directions).
- `POST /api/users/:id/block` — `JwtAuthGuard`; toggle endpoint.
- `PostsService.createReport` — creates `Report { status: 'OPEN' }`; `POST /api/posts/:id/report`. `JwtAuthGuard`.
- `PostsService.findAllReports` — `GET /api/posts/admin/reports`; returns all `OPEN` reports with reporter + post. `JwtAuthGuard` (role guard added in Phase 12).
- `PostsService.findAll` — fetches `Block` rows for `userId` at query start; adds `userId: { notIn: blockedIds }` to home, explore, and guest feed `whereCondition`.
- `SearchService.search` — filters blocked users/posts from both `posts` and `users` query results.
- `NotificationsService.findAll` — adds `actorId: { notIn: blockedIds }` to the notification query.
- `PostInfo.tsx` — non-owner logged-in users now see a dropdown with "Report post" option; fires `POST /api/posts/:id/report` with `{ reason: "Other" }`.
- `UserActions.tsx` (new client component) — "more" dropdown with "Block/Unblock @username"; hides `FollowButton` while blocked; invalidates `["posts"]` cache on block.
- `[username]/page.tsx` — replaced static "more" + `FollowButton` with `<UserActions>`; not rendered on own profile.

**Schema:** `ReportStatus ENUM(OPEN|CLOSED)`, `Block { id, blockerId, blockedId, createdAt, @@unique([blockerId, blockedId]) }`, `Report { id, reporterId, postId, reason, status, createdAt }`.

Migration: `apps/backend/prisma/migrations/20260429062512_add_block_report/migration.sql`

**Exit checklist**
- [x] After A blocks B: B's posts/replies/notifications invisible to A and vice-versa; existing follows removed.
- [x] Reporting a post creates an `OPEN` `Report` row in DB.

---

## Phase 8 — Profile Editing Polish ✅  *(UC-U-PR-01)*

Done:
- `UpdateUserDto` — `apps/backend/src/users/dto/update-user.dto.ts`; fields: `displayName?`, `bio?`, `location?`, `job?`, `website?`, `img?`, `cover?`.
- `UsersService.updateProfile` — sparse Prisma update; returns updated user with all profile fields.
- `PATCH /api/users/me` — `JwtAuthGuard`; placed before `/:username` GET to avoid route collision.
- `AuthService.me()` extended to select all profile fields (`displayName`, `bio`, `location`, `job`, `website`, `cover`) so `GET /api/auth/me` stays consistent after edits.
- `SessionUser` type in `apps/frontend/src/lib/session.ts` extended to match.
- `EditProfileModal.tsx` — client component; avatar (imgType=square) + cover (imgType=wide) upload via `apiMultipart`; text fields; `PATCH /api/users/me` on save; `router.refresh()` on success.
- `EditProfileButton.tsx` — thin client wrapper that owns modal open/close state.
- `[username]/page.tsx` — renders `<EditProfileButton>` on own profile; `<UserActions>` on others'.
- No migration needed — `cover String?` already existed on `User` from the initial schema.
- Username editing intentionally omitted (locked at registration).

**Exit checklist**
- [x] All profile fields editable; persist and render on next visit.
- [x] Avatar and cover image update correctly.

---

## Phase 9 — v1 Hardening & Launch ✅  *(absorbs divide Stage 7)*

**Goal:** Production-ready first release.

**Storage — Cloudinary CDN (replaces sharp + local disk)**
- `UploadsService.saveFile()` uploads to Cloudinary when `CLOUDINARY_CLOUD_NAME` env is set; falls back to local disk otherwise.
- `imgType` maps to Cloudinary transformations (SDK object format): `square` → `[{width:600,height:600,crop:'fill'}]`, `wide` → `[{width:600,height:338,crop:'fill'}]`, default → `[{width:1200,crop:'limit'}]`.
- Returns `secure_url` (full `https://res.cloudinary.com/...`) instead of bare filename — stored directly in DB.
- `Image.tsx` updated to pass `https://` paths straight through (no mangling).
- `Video.tsx` updated with same `https://` prefix check — bare filenames → `${BACKEND_URL}/uploads/`, full URLs → pass through.
- `next.config.ts` adds `res.cloudinary.com` to `remotePatterns`.
- `docker-compose.yml` backend `environment:` block explicitly forwards all three Cloudinary vars.
- Old bare-filename records coexist — `Image.tsx`/`Video.tsx` still resolve them via local path.
- Env: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.

**Rate limiting — `@nestjs/throttler` + Redis store**
- Global `ThrottlerGuard` in `AppModule`: default 120 req/min.
- Auth mutation routes (register, login, verify): 10 req/min; verify/resend, forgot-password, reset-password: 5 req/min.
- `GET /api/auth/me`: `@SkipThrottle()`.

**SEO — OpenGraph meta**
- `generateMetadata()` on `[username]/page.tsx`: `og:title`, `og:description`, `og:image` from user profile.
- `generateMetadata()` on `[username]/status/[postId]/page.tsx`: author + post text + post image.

**Frontend error boundaries**
- `app/(board)/error.tsx`, `[username]/error.tsx`, `[username]/status/[postId]/error.tsx` — each renders "Something went wrong" + retry button.

**Bug fixes (post-phase debug)**
- `UpdateUserDto` decorators — all fields were missing `@IsOptional()/@IsString()` → `ValidationPipe({ whitelist: true })` stripped everything on profile edit.
- `posts.service.ts` — upload always stored to `img` field regardless of mimetype; fixed with `isVideo()` helper routing to `video` field.
- `NotificationsFeed.tsx`, `Comments.tsx`, `Share.tsx`, `LeftBar.tsx` — avatar `src=` props replaced with `path=` to fix bare-filename resolution.
- Cloudinary `transformation` format — SDK requires object array, not URL-style string.

**Deferred to later phases / post-launch:**
- Zod schemas in `packages/shared`.
- Accessibility pass (landmarks, focus traps, keyboard nav).
- Playwright E2E suite.
- Structured logs (pino) + Sentry.
- Production deploy guide + volume backup strategy.

**Exit checklist**
- [x] `docker compose up --build` cold-start; all four containers healthy.
- [x] Upload avatar → stored at `res.cloudinary.com`, displays in Share + LeftBar.
- [x] Post image/video → Cloudinary URL stored; displays correctly in feed.
- [x] Old posts with bare filenames still display.
- [x] Profile fields (bio, location, website, img, cover) persist after edit.
- [x] Notification and reply-box avatars display correctly.
- [x] Hammer `POST /api/auth/login` 11×/min → 429 from throttler.
- [x] Profile page `<head>` contains correct `og:title`.
- [x] Navigate to broken route → error boundary renders with retry button.

---

## Phase 10 — Direct Messaging & Multi-media ✅ *(UC-U-MG-01..02)*

**Backend:**
- `MessagesModule` — `Conversation`, `ConversationMember`, and `Message` models. 
- Socket.IO integration: messages are pushed in real-time to the recipient's room.
- `api/conversations` endpoints for listing conversations, fetching messages, and sending new ones.
- **Multi-media Schema:** Migrated `Post.img` and `Post.video` to a dedicated `PostMedia` model to allow multiple attachments per post.

**Frontend:**
- `/messages` route: Conversation list sidebar with a message thread view.
- Real-time updates: `newMessage` socket event appends messages to the cache.
- **Media Viewer:** Added `MediaViewer` (lightbox) component for full-screen viewing of images and videos in both messages and posts.
- **Multi-media Posting:** Updated `Share.tsx` to support multiple file selection, editing, and grid-based previews before posting.
- **Grid Layout:** Posts now render multiple media items in a responsive grid.

**Schema:** 
```prisma
model PostMedia {
  id     Int    @id @default(autoincrement())
  url    String
  type   String
  postId Int
  post   Post   @relation(fields: [postId], references: [id], onDelete: Cascade)
}
```

Migration: `apps/backend/prisma/migrations/20260430132754_add_post_media/migration.sql`

**Exit checklist**
- [x] Send/receive messages in real-time.
- [x] Click image/video in message or post to open full-screen viewer.
- [x] Select and post up to 10 images/videos in a single post.
- [x] Post media renders in a grid layout.

---

## Phase 11 — Communities & Moderation ✅ *(UC-U-CM-01..04, UC-M-01..05)*

**Backend:**
- `CommunitiesModule` — full lifecycle: create, browse/search (auth-aware, filters banned communities per user), join/leave toggle, update settings, delete (cascade: soft-delete posts → remove bans/rules/members → delete community).
- **Schema:** `Community { id, name, slug, description, img?, cover?, createdAt }`, `CommunityMember { userId, communityId, role: ENUM(MEMBER|MOD|OWNER), @@unique }`, `CommunityRule { id, communityId, title, description? }`, `CommunityBannedUser { userId, communityId, reason?, createdAt, @@unique }`, `Post.communityId Int?`, `Post.isApproved Boolean @default(true)`, `NotificationType` extended with `COMMUNITY_POST` and `COMMUNITY_NEW_POST`.
- **Endpoints (User):** `GET /api/communities` (browse/search; `OptionalJwtAuthGuard` → filters banned communities), `GET /api/communities/:slug` (returns `membership` + `isBanned` for logged-in user), `POST /api/communities` (create; `JwtAuthGuard` + `EmailVerifiedGuard`), `POST /api/communities/:id/join` (toggle join/leave; ban-checked).
- **Endpoints (Mod/Owner):** `PATCH /api/communities/:id` (update settings), `POST /api/communities/:id/rules` (add rule), `DELETE /api/communities/:id/rules/:ruleId` (remove rule), `POST /api/communities/:id/ban/:userId` (ban + remove member), `DELETE /api/communities/:id/ban/:userId` (unban), `GET /api/communities/:id/bans` (list banned users), `POST /api/communities/:id/promote/:userId` (set MOD role), `POST /api/communities/:id/transfer/:newOwnerId` (ownership transfer), `GET /api/communities/:id/posts/pending` (pending approval queue), `POST /api/communities/:id/posts/:postId/moderate` (APPROVE → sets `isApproved: true` + notifies all members; REMOVE → soft-deletes), `DELETE /api/communities/:id` (owner-only delete).
- **Post integration:** `PostsService.create` checks community membership + ban; OWNER/MOD posts auto-approve (`isApproved: true`), MEMBER posts start pending (`isApproved: false`) and notify all staff via `COMMUNITY_POST`. Approved posts notify all members via `COMMUNITY_NEW_POST`. Community posts excluded from home feed, profile feed, media tab, and global search.

**Frontend:**
- **Routes:** `/communities` (discovery grid; session-forwarded SSR to filter banned), `/communities/new` (`CreateCommunityForm` client component), `/c/[slug]` (community feed with `PendingPostsBanner` for OWNER/MOD above the feed), `/c/[slug]/about` (rules, members with role badges, `CommunityAboutAdmin` panel for staff).
- **`CommunityHeader`** — role badge (OWNER gold / MOD blue / Banned red) + "Manage" link for staff, Join/Leave toggle for members, no action for banned users.
- **`CommunityAboutAdmin`** (client) — four sections: Pending Approval (approve/reject with instant removal from list), Add Rule form, Ban Members (filterable by role), Banned Users list with Unban button, Delete Community (OWNER only; two-step confirm).
- **`PendingPostsBanner`** (client) — fetches pending queue on mount; renders above feed for OWNER/MOD with approve/reject per post; invisible when queue is empty.
- **Ban enforcement:** banned user visiting `/c/[slug]` sees a "You are banned" screen (no feed, no share box); community does not appear in `/communities` listing or search.
- **Notifications:** `NotificationsFeed` handles `COMMUNITY_POST` ("submitted a post pending your approval") and `COMMUNITY_NEW_POST` ("posted in a community you're in").
- **Feed filtering:** home feed, explore feed, guest feed, profile tabs, and global search all exclude community posts.
- **Chat popup fix:** `ChatPopupManager` shifted left on `lg` screens (`right-4 lg:right-20`) to clear the right-bar toggle button.

**Schema migrations:**
- `20260501050939_add_communities` — `Community`, `CommunityMember`, `CommunityRule`, `Post.communityId`, `Post.isApproved`.
- `20260501060654_add_community_bans` — `CommunityBannedUser`.
- `20260501150000_add_community_notifications` — `ALTER TYPE "NotificationType" ADD VALUE 'COMMUNITY_POST'`; `ADD VALUE 'COMMUNITY_NEW_POST'`.

**Exit checklist**
- [x] Create community → owner auto-joined as OWNER; appears in `/communities`.
- [x] Join/leave toggle works; banned users cannot rejoin (403).
- [x] Member post → pending; OWNER/MOD post → auto-approved and visible in feed.
- [x] Admin sees `PendingPostsBanner` on community page; approve → post appears in feed + all members notified; reject → post removed.
- [x] Admin can add/remove rules, ban/unban members, promote to MOD, transfer ownership, delete community.
- [x] Banned user visiting `/c/[slug]` sees ban screen; community hidden from listing/search.
- [x] Community posts do NOT appear in home feed, profile tabs, or global search.
- [x] `COMMUNITY_POST` and `COMMUNITY_NEW_POST` notifications delivered in real time and shown in notification feed.

---

## Phase 12 — Admin Console ✅ *(UC-A-01..06)*

Done:
- **Renamed Route:** Moved from `/admin` to `/admin-console` to avoid conflict with the `@admin` user profile page.
- **Admin Sidebar:** Added "Admin Console" link to the left sidebar for users with `ADMIN` role.
- **User Management:** `GET /api/admin/users` paginated list with search; Ban/Unban functionality with `BannedUserGuard` blocking write access for suspended users.
- **Report Management:** `GET /api/admin/reports` (OPEN status); integrated with `PostInfo.tsx` which now uses a modal for report reasons; admins can Dismiss reports or Delete reported posts.
- **Admin Notifications:** `REPORT` notification type added; `PostsService.createReport` now notifies all administrators in real-time when a new report is submitted.
- **UI Enhancements:**
  - Added links to user profiles (opening in new tabs) in both User and Report tables.
  - Report table links directly to the reported post's status page.
- **Verification:** Seeded `admin` account (password `123456`) has full access to the console.

**Schema:** `User.role ENUM(USER|ADMIN)`, `User.banned Boolean`, `NotificationType` extended with `REPORT`.

Migration: `20260501082428_add_admin_role_and_ban`, `20260501085924_add_report_notification`.

**Exit checklist**
- [x] Log in as `admin` → "Admin Console" appears; clicking it works (redirects to `/admin-console/users`).
- [x] Admin can ban a user → user sees suspension screen on next reload; cannot post/like/reply (403).
- [x] User reports a post with a reason via modal → admins receive real-time notification.
- [x] Admin visits `/admin-console/reports` → clicking the reported post link opens the post in a new tab.
- [x] Admin can delete reported post or dismiss report.
- [x] Admin can visit their own profile at `/admin` without being redirected to the dashboard.

---

## Phase 13 — Notification Preferences, Post Edits & Pinned Posts *(future)* *(UC-U-NT-05, UC-E-03..04, UC-U-PM-02, UC-U-PM-04)*

**Backend:**
- **Notification Preferences (UC-U-NT-05):** `NotificationPreference` schema per user × event type (LIKE, REPLY, etc.) × channel (in-app, email, push).
- **Email Digests (UC-E-04):** Cron jobs (daily/weekly) via `@nestjs/schedule` or BullMQ on Redis to dispatch email digests.
- **Security Alerts (UC-E-03):** Send email on new device login or suspicious IP.
- **Post Edits (UC-U-PM-02):** `PATCH /api/posts/:id` allowing text edits within a short grace window. Schema: `Post.editedAt DateTime?`.
- **Pinned Posts (UC-U-PM-04):** Schema: `User.pinnedPostId Int?`. Endpoint to toggle the pinned post on a user's profile.

**Frontend:**
- **Settings:** `/settings/notifications` page to toggle email/push preferences.
- **Post UI:** "Edit post" option in the post dropdown (only visible within the grace window); display an "Edited" badge with timestamp on modified posts.
- **Profile UI:** "Pin to profile" action; display the pinned post at the top of the `/[username]` feed.

---

## Cross-Cutting Concerns

- **Migrations:** every schema change → `npx prisma migrate dev --name <name> --schema=apps/backend/prisma/schema.prisma`; commit `apps/backend/prisma/migrations/`.
- **Auth guard:** `JwtAuthGuard` on all write endpoints; `EmailVerifiedGuard` on content-creation endpoints.
- **Caching:** TanStack Query on the frontend; backend may cache public feed pages in Redis (TTL 30–60 s, invalidated on post create/delete) from Phase 9 onward.
- **Real-time:** `NotificationsModule` WebSocket gateway is the delivery channel; persisted `Notification` rows are the system of record (Phase 6+).
- **Types:** shared DTOs live in `packages/shared/src/index.ts`; build with `npm run build -w @breadit/shared` after changes.
- **Feature flags:** gate future-phase code paths so trunk stays releasable.
- **Email:** backend uses nodemailer SMTP (not Resend). Provider configured via `SMTP_HOST/PORT/USERNAME/PASSWORD/FROM` env vars.
- **Media (UC-U-PM-01-ext-a):** local disk + sharp is the v1 implementation. CDN migration planned for Phase 9.

---

## Verification Strategy (per phase)

Each phase ships with:
1. TypeScript compiles clean: `npm run typecheck`.
2. Lint passes: `npm run lint -w @breadit/frontend`.
3. Manual smoke checklist documented in the phase's exit criteria.
4. `docker compose up --build` — all containers healthy before merging.
