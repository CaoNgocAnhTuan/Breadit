# Functional Requirements — Breadit (X Clone)

This document describes how the **Breadit** codebase behaves today (NestJS + Next.js monorepo). Wording follows the original use-case IDs where they still apply.

## 1. Actors and Roles

| Role | Description |
| :--- | :--- |
| **Guest** | Unauthenticated visitor. Can view public content but cannot interact. |
| **User** | Authenticated user with a verified email. Can create content, interact, and message. |
| **Community Moderator** | A User with elevated permissions within a specific community (Mod/Owner). |
| **Admin** | Site-wide administrator (`User.role = ADMIN`) with access to the Admin Console and global moderation. |

---

## 2. Authentication & Account Management

- **UC-AUTH-01: Registration:** Users sign up with a unique username, email, and password (`POST /api/auth/register`).
- **UC-AUTH-02: Email Verification:** New accounts verify via a **6-digit code / OTP** sent by email (`POST /api/auth/verify`, resend with rate limits). Unverified users cannot post (guarded routes).
- **UC-AUTH-03: Login/Logout:** Session is an **HTTP-only JWT cookie** named `breadit_session` (not NextAuth).
- **UC-AUTH-04: Password Recovery:** Forgot-password + reset flow via email with time-limited token (see `AuthService`).
- **UC-AUTH-05: Account Security:** Auth mutations use `@nestjs/throttler` (e.g. **10 requests per 60s** for register/login/verify; tighter limits on forgot/reset/resend). A global throttle also applies to other routes.

---

## 3. User Profile Management

- **UC-PROF-01: Profile Customization:** Users can edit display name, bio, location, job, and website (`PATCH` user profile). Field max lengths are enforced in DTOs (not all 255 — e.g. bio up to 160).
- **UC-PROF-02: Media Branding:** Avatar and cover image supported (URLs/paths from upload flow).
- **UC-PROF-03: Profile Views:** Own or others’ profiles; tabs for **Posts, Replies, Media, Likes** (non-community posts for several tabs). Optional in-tab search on posts where implemented.
- **UC-PROF-04: Theme Preference:** **Not implemented.** The app uses a fixed dark-oriented UI; there is no persisted Light / Dark / System toggle in `User` or the frontend layout.

---

## 4. Content Creation & Discovery

- **UC-POST-01: Create Post:** Text description up to **255 characters** (`Post.desc` / `VarChar(255)`).
- **UC-POST-02: Multi-media Attachments:** Multiple files per post (images and video). **Cloudinary** is used when `CLOUDINARY_CLOUD_NAME` (and keys) are set; otherwise media is stored on **local disk** (`UPLOAD_DIR`) with processing via **sharp** where applicable. There is **no hard “max 10 files” check** in the API or `Share` composer today — only practical limits (e.g. upload size).
- **UC-POST-03: Hashtags:** `#tokens` are parsed and linked to hashtag records for discovery and hashtag pages.
- **UC-POST-04: Mentions:** `@username` is parsed; **mention rows and notifications are created only for users the author already follows** (mentions in posts and comments use this filter). Not “any username on the platform.”
- **UC-POST-05: Feed Discovery (home):**
    - **For you (default):** Posts from **the current user and accounts they follow** (non-community root posts), chronological.
    - **Explore (`?feed=explore`):** Root posts **excluding community posts**, ordered primarily by **like count** (trending), then recency.
    - **Following (`?feed=following`):** Only posts from followed accounts (not including own posts in that filter).
    - **Communities (`?feed=communities`):** Aggregated approved posts from communities the user is a member of.
    - **Hashtag feed (`/hashtag/[tag]`):** Root posts with that tag **excluding community posts** (pagination separate from home).
- **UC-POST-06: Search:** `GET /api/search?q=` runs **parallel** queries for posts, users, hashtags, and **communities**. Post hits are **non-community** root posts matching description text. The **header search dropdown** (`Search.tsx`) surfaces **People, Communities, Hashtags, and Posts**. The **full-page** route `/search` currently lists **People, Hashtags, and Posts** only (communities omitted there).
    - **Full-page `/search`** shows **People, Communities, Hashtags, and Posts** (aligned with the header dropdown).
- **UC-POST-07: Deletion:** Authors can **soft-delete** their posts (`deletedAt`), hiding them from feeds and lookups that respect deletion.

---

## 5. Social Interactions

### Blocking policy (authenticated viewer)

If viewer **A** and profile **B** have **any** block row (either direction), and **A is logged in**:

| Surface | Behavior |
| :--- | :--- |
| `GET /api/users/:username` | **`profileRestricted: true`** plus `blockedByYou` / `blockedYou`; **no** full bio, avatar, cover, or follower counts (privacy shell). |
| `GET /api/posts/:id` (single post) | Returns **null / 404** when the viewer is blocked with the post author (same as timeline). **Guests** still see public posts. |
| Followers / following (`GET .../followers`, `.../following`) | **Empty list** for that viewer (with session cookie). |
| DMs | **Cannot** create/open thread or send/mark read while blocked; blocked 1:1 threads are **omitted** from conversation list, search, and unread totals. |

**Guests** (no cookie) still see **full** public profiles — block checks apply only when `OptionalJwt` / JWT identifies the viewer.

**Unblock:** `POST /api/users/:id/block` toggles. Users you have blocked are listed at **`GET /api/users/me/blocked`** and in the UI under **Settings → Blocked accounts**.

---

- **UC-INT-01: Like/Unlike:** Supported on posts (and comment likes where implemented).
- **UC-INT-02: Reposting:** Plain repost and quote-repost supported via post/repost model.
- **UC-INT-03: Bookmarking:** Save posts to a private bookmarks list.
- **UC-INT-04: Threaded Comments:** Replies to posts with optional threading and media.
- **UC-INT-05: Follow Graph:** Follow/unfollow, followers and following lists. The `Follow.notify` flag exists in the **database and API**, but there is **no frontend toggle** and **no logic** that uses it to push “new post” alerts — only the usual interaction notifications (e.g. follow event).
- **UC-INT-06: Safety — Blocking:** As in the table above: **bidirectional** wall for feeds/search/notifications (existing), plus **restricted profile API**, **no timeline**, **no DM**, **blocked-account settings**, and **severed mutual follows** on create block.

---

## 6. Real-time Notifications

- **UC-NOTI-01: Notification Types (persisted):** Align with Prisma `NotificationType`: **LIKE, REPLY, REPOST, FOLLOW, MENTION**, **COMMUNITY_MOD_ADDED, COMMUNITY_POST** (e.g. member post pending approval), **COMMUNITY_NEW_POST** (approved community post to members), **REPORT** (admin/report pipeline).
- **UC-NOTI-02: Persistence:** Stored in DB with `readAt` for unread/read state.
- **UC-NOTI-03: Real-time Delivery:** **Socket.IO** gateway validates `breadit_session` on connect; broadcasts use a **Redis adapter** for multi-instance scaling.
- **UC-NOTI-04: Bulk Actions:** `PATCH` to mark all notifications read.

---

## 7. Direct Messaging (DMs)

- **UC-MSG-01: 1:1 Messaging:** Real-time-capable private conversations between users. **Blocked pairs** cannot open or continue DMs (see §5 blocking table).
- **UC-MSG-02: Conversation Management:** Conversation list with previews and unread counts.
- **UC-MSG-03: Media Support:** Images/video in threads; lightbox-style viewing where implemented in the client.

---

## 8. Communities (Groups)

- **UC-COMM-01: Community Lifecycle:** Create communities with slug, name, description; browse and join flows.
- **UC-COMM-02: Roles & Permissions:** Owner / Moderator / Member; staff can manage rules, membership, and bans.
- **UC-COMM-03: Moderation Queue:** Non-staff posts can require approval; staff get **COMMUNITY_POST** notifications; members get **COMMUNITY_NEW_POST** when approved auto-posts go out.
- **UC-COMM-04: Rules Engine:** Staff-defined rules stored and shown on community about pages.
- **UC-COMM-05: Member Bans:** Banned users cannot participate in that community.
- **UC-COMM-06: Feed Privacy:** Community posts are **omitted from the main Explore feed and from global post search** (`communityId` must be null there). **Hashtag feeds do not currently filter out community posts** — a tagged community post can still appear on `/hashtag/:tag`.

---

## 9. Admin Console

- **UC-ADMN-01: User Management:** List/search users; global **ban/unban**.
- **UC-ADMN-02: Report Handling:** Queue for reported posts — dismiss or take action (e.g. delete content / close report) per `AdminService` routes.
- **UC-ADMN-03: Real-time Alerts:** Admins can receive **REPORT** notifications when content is reported.

---

## 10. System Requirements (Functional Context)

- **Scalability:** Socket.IO uses the **Redis** adapter (`@socket.io/redis-adapter`) when `REDIS_URL` is available.
- **Performance:** Debounced search in the UI; **cursor/page-based pagination** on feeds; media via Cloudinary or static files from the API.
- **Reliability:** Frontend error boundaries where present; NestJS **exception filter** for consistent HTTP errors.

---

## Document history

- **As of 2026-05 (blocking):** Stricter block — restricted profile payload, 403 profile posts, DM guard, `GET /api/users/me/blocked`, Settings UI; bidirectional policy table in §5.
