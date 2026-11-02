# Database Schema — Breadit

**Engine:** PostgreSQL 16 · **ORM:** Prisma · **Schema file:** `apps/backend/prisma/schema.prisma`

---

## Quick Reference

| # | Model | PK type | Purpose |
|---|-------|---------|---------|
| 1 | `User` | cuid (String) | Central identity for every platform action |
| 2 | `Account` | cuid (String) | OAuth provider accounts (NextAuth boilerplate, currently unused) |
| 3 | `Session` | cuid (String) | NextAuth DB sessions (boilerplate, currently unused) |
| 4 | `VerificationToken` | composite | One-time tokens for email verify & password reset |
| 5 | `Post` | autoincrement (Int) | Primary content unit; supports threading and reposts via self-references |
| 6 | `PostMedia` | autoincrement (Int) | Image/video/file attachments belonging to a Post |
| 7 | `Hashtag` | autoincrement (Int) | Deduplicated tag registry |
| 8 | `PostTag` | composite | Join table — Post ↔ Hashtag (many-to-many) |
| 9 | `Like` | autoincrement (Int) | Records a user liking a post |
| 10 | `SavedPosts` | autoincrement (Int) | Records a user bookmarking a post |
| 11 | `Follow` | autoincrement (Int) | Directed user-to-user follow with notification preference |
| 12 | `Block` | autoincrement (Int) | Directed user-to-user block |
| 13 | `Notification` | autoincrement (Int) | All platform alerts (likes, replies, follows, community events, …) |
| 14 | `Report` | autoincrement (Int) | Content moderation reports by users against posts |
| 15 | `Conversation` | autoincrement (Int) | Container for a private-message thread |
| 16 | `ConversationMember` | composite | Join table — User ↔ Conversation, stores read-cursor |
| 17 | `Message` | autoincrement (Int) | Individual message within a Conversation |
| 18 | `Community` | autoincrement (Int) | Subreddit-style group with slug, rules, and moderation |
| 19 | `CommunityMember` | autoincrement (Int) | Join table — User ↔ Community, stores role |
| 20 | `CommunityRule` | autoincrement (Int) | Freetext rule belonging to a Community |
| 21 | `CommunityBannedUser` | autoincrement (Int) | Community-scoped ban (separate from global platform ban) |
| 22 | `Comment` | autoincrement (Int) | User comment on a Post, supports nested replies |
| 23 | `CommentMedia` | autoincrement (Int) | Image/video/file attachments belonging to a Comment |
| 24 | `CommentLike` | autoincrement (Int) | Records a user liking a comment |
| 25 | `Mention` | autoincrement (Int) | Mentions (@username) inside Posts and Comments |

---

## Enums

### `Role`
Global platform role on the `User` record.

| Value | Meaning |
|-------|---------|
| `USER` | Regular authenticated user (default) |
| `ADMIN` | Platform administrator — unlocks admin dashboard |

### `NotificationType`
Discriminates every row in `Notification`.

| Value | Triggered when |
|-------|---------------|
| `LIKE` | Another user likes your post |
| `REPLY` | Another user replies to your post |
| `REPOST` | Another user reposts your post |
| `FOLLOW` | Another user follows you |
| `MENTION` | Your `@username` appears in a post |
| `COMMUNITY_MOD_ADDED` | You are promoted to moderator of a community |
| `COMMUNITY_POST` | A member submits a post pending mod approval (sent to mods) |
| `COMMUNITY_NEW_POST` | A pending post is approved (sent to community members) |
| `REPORT` | A post you own has been reported (sent to admins/mods) |

### `ReportStatus`

| Value | Meaning |
|-------|---------|
| `OPEN` | Report awaiting moderator review (default) |
| `CLOSED` | Report has been reviewed and resolved |

### `CommunityRole`
Per-community role stored in `CommunityMember`.

| Value | Meaning |
|-------|---------|
| `MEMBER` | Regular community participant (default) |
| `MOD` | Moderator — can approve posts, manage members |
| `OWNER` | Community creator — has all mod powers; only one per community |

---

## Tables — Detailed Reference

---

### 1. `User`

**Purpose:** The platform's central identity record. Every action (posts, likes, follows, messages, etc.) traces back to a User.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | String | PK, `@default(cuid())` | CUID v1 string — collision-resistant, sortable |
| `email` | String | `@unique` | Used for login and email verification |
| `username` | String | `@unique` | Public handle (`@username`) |
| `password` | String? | nullable | bcrypt hash (10 salt rounds); null for OAuth users |
| `emailVerified` | DateTime? | nullable | Set when the user completes 6-digit OTP verification; null = unverified |
| `displayName` | String? | nullable | Optional "pretty name" shown in UI |
| `bio` | String? | nullable | Profile biography |
| `location` | String? | nullable | Free-text location |
| `job` | String? | nullable | Free-text occupation |
| `website` | String? | nullable | Personal website URL |
| `img` | String? | nullable | Avatar — bare UUID filename (local) or full Cloudinary URL |
| `cover` | String? | nullable | Profile cover image — same format as `img` |
| `role` | Role | `@default(USER)` | `USER` or `ADMIN` |
| `banned` | Boolean | `@default(false)` | Global platform ban; checked by `BannedUserGuard` |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | Auto-managed by Prisma |

**Outgoing relations (User owns/initiates):**

| Relation field | Points to | Cardinality | Notes |
|----------------|-----------|-------------|-------|
| `posts` | `Post[]` | 1 → many | All posts authored by this user |
| `likes` | `Like[]` | 1 → many | Likes this user has given |
| `saves` | `SavedPosts[]` | 1 → many | Posts this user has bookmarked |
| `followers` | `Follow[]` "UserFollowers" | 1 → many | **Outbound** follows — people this user IS following (see gotcha below) |
| `followings` | `Follow[]` "UserFollowings" | 1 → many | **Inbound** follows — people who follow this user |
| `sentNotifications` | `Notification[]` "SentNotifications" | 1 → many | Notifications this user triggered as actor |
| `blockerRelations` | `Block[]` "BlockerUser" | 1 → many | Blocks initiated by this user |
| `reports` | `Report[]` | 1 → many | Reports filed by this user |
| `sentMessages` | `Message[]` | 1 → many | DM messages sent by this user |
| `communities` | `CommunityMember[]` | 1 → many | Community memberships |
| `bannedFrom` | `CommunityBannedUser[]` | 1 → many | Community-level bans |
| `accounts` | `Account[]` | 1 → many | OAuth accounts (boilerplate, unused) |
| `sessions` | `Session[]` | 1 → many | NextAuth sessions (boilerplate, unused) |

**Incoming relations:**

| Relation field | From | Notes |
|----------------|------|-------|
| `receivedNotifications` | `Notification[]` "ReceivedNotifications" | Notifications addressed to this user |
| `blockedRelations` | `Block[]` "BlockedUser" | Blocks where this user is the target |
| `conversationMembers` | `ConversationMember[]` | DM thread memberships |

> **Schema naming gotcha:** `User.followers` (relation name "UserFollowers") stores `Follow` rows where `followerId = this user` — meaning **this user is doing the following**. `User.followings` (relation name "UserFollowings") stores rows where `followingId = this user` — meaning **others follow this user**. The names are reversed from intuition.

---

### 2. `Account`

**Purpose:** Stores OAuth provider tokens linked to a User (e.g., Google, GitHub). This is standard NextAuth schema boilerplate. **Currently unused** — the project uses custom JWT authentication instead.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String | PK, cuid |
| `userId` | String | FK → `User.id` (cascade delete) |
| `type` | String | Provider type (e.g., "oauth") |
| `provider` | String | Provider name (e.g., "google") |
| `providerAccountId` | String | User's ID at the provider |
| `refresh_token` | String? | `@db.Text` |
| `access_token` | String? | `@db.Text` |
| `expires_at` | Int? | Unix timestamp |
| `token_type` | String? | |
| `scope` | String? | |
| `id_token` | String? | `@db.Text` |
| `session_state` | String? | |

**Constraints:** `@@unique([provider, providerAccountId])` — one account per provider per user.

---

### 3. `Session`

**Purpose:** Stores NextAuth server-side sessions. **Currently unused** — the project uses `VerificationToken` + custom `breadit_session` JWT cookie instead.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | String | PK, cuid |
| `sessionToken` | String | `@unique` |
| `userId` | String | FK → `User.id` (cascade delete) |
| `expires` | DateTime | Session expiry |

---

### 4. `VerificationToken`

**Purpose:** Single-use tokens for two flows — email OTP verification and password reset.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `identifier` | String | part of composite PK | Prefixed key: `"email-verify:<userId>"` or `"password-reset:<userId>"` |
| `token` | String | `@unique` | 6-digit numeric string (email verify) or `crypto.randomUUID()` (password reset) |
| `expires` | DateTime | | 15 minutes for email OTP; 1 hour for password reset |

**Constraints:** `@@unique([identifier, token])` — composite unique enforces one active token per flow per user.

**Business rules:**
- Token is deleted from DB after first successful use (single-use).
- `forgotPassword` and `resendVerificationCode` always return HTTP 200 to prevent user enumeration.

---

### 5. `Post`

**Purpose:** The primary content unit. Handles original posts, threaded replies (comments), and reposts/shares via two self-referential FK columns.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |
| `deletedAt` | DateTime? | nullable | **Soft delete** — post is hidden but row is preserved for data integrity |
| `desc` | String? | `@db.VarChar(255)` | Text body; optional (media-only posts are valid) |
| `isSensitive` | Boolean | `@default(false)` | Marks NSFW/sensitive content |
| `isApproved` | Boolean | `@default(true)` | `false` when posted to a community that requires mod approval |
| `userId` | String | FK → `User.id` | Author |
| `rePostId` | Int? | FK → `Post.id` (self) | Points to the original post being shared |
| `parentPostId` | Int? | FK → `Post.id` (self) | Points to the parent when this post is a reply |
| `communityId` | Int? | FK → `Community.id` | Null for personal/timeline posts |

**Self-referential relations:**

| Relation name | Field | Direction | Meaning |
|---------------|-------|-----------|---------|
| "RePosts" | `rePostId` | child → parent | This post is a repost of `rePost` |
| "RePosts" | `rePosts[]` | parent → children | Posts that share this post |
| "PostComments" | `parentPostId` | reply → parent | This post is a reply to `parentPost` |
| "PostComments" | `comments[]` | parent → replies | Direct replies to this post |

**Outgoing relations:**

| Field | Points to | Notes |
|-------|-----------|-------|
| `media` | `PostMedia[]` | Attached images/videos/files |
| `likes` | `Like[]` | Users who liked this post |
| `saves` | `SavedPosts[]` | Users who bookmarked this post |
| `tags` | `PostTag[]` | Hashtags on this post |
| `notifications` | `Notification[]` | Notifications referencing this post |
| `reports` | `Report[]` | Moderation reports on this post |
| `community` | `Community?` | Community it belongs to (if any) |

---

### 6. `PostMedia`

**Purpose:** Stores one attachment (image, video, or file) per row. A post can have up to 10 attachments (enforced by `@fastify/multipart` limit).

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | |
| `url` | String | | Bare UUID filename (local) or full Cloudinary URL |
| `type` | String | | `"IMAGE"` \| `"VIDEO"` \| `"FILE"` — plain string, not a Prisma enum |
| `height` | Int? | nullable | Pixel height; populated for images by `sharp` or Cloudinary |
| `width` | Int? | nullable | Pixel width |
| `postId` | Int | FK → `Post.id` | `onDelete: Cascade` — rows deleted automatically when Post is hard-deleted |
| `createdAt` | DateTime | `@default(now())` | |

**Note:** Soft-deleted posts (via `deletedAt`) do NOT cascade-delete their `PostMedia` — the media rows remain. Hard deletion of a Post row triggers the cascade.

---

### 7. `Hashtag`

**Purpose:** Registry of all unique hashtag strings. Normalized to avoid duplication; tags are stored lowercase.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `tag` | String | `@unique` |
| `createdAt` | DateTime | `@default(now())` |

**Outgoing relations:** `posts PostTag[]` — all `PostTag` join rows referencing this hashtag.

---

### 8. `PostTag`

**Purpose:** Many-to-many join table linking `Post` ↔ `Hashtag`.

| Column | Type | Constraints |
|--------|------|-------------|
| `postId` | Int | PK (composite), FK → `Post.id` |
| `hashtagId` | Int | PK (composite), FK → `Hashtag.id` |

**PK:** `@@id([postId, hashtagId])` — a post can use each hashtag at most once.

---

### 9. `Like`

**Purpose:** Records a single "like" event from a User on a Post. Used for engagement counts and feed ranking.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `createdAt` | DateTime | `@default(now())` |
| `userId` | String | FK → `User.id` |
| `postId` | Int | FK → `Post.id` |

**Note:** There is no `@@unique([userId, postId])` constraint in the schema — duplicate like prevention is enforced at the application layer.

---

### 10. `SavedPosts`

**Purpose:** Personal bookmarks. Allows a user to save any post for later retrieval from their "Saved" feed.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `createdAt` | DateTime | `@default(now())` |
| `userId` | String | FK → `User.id` |
| `postId` | Int | FK → `Post.id` |

---

### 11. `Follow`

**Purpose:** Directed social graph edge — one User follows another. Includes a per-follow notification preference toggle.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | |
| `createdAt` | DateTime | `@default(now())` | |
| `notify` | Boolean | `@default(false)` | When `true`, the follower receives push notifications for new posts from the followed user |
| `followerId` | String | FK → `User.id` | The user WHO IS DOING the following |
| `followingId` | String | FK → `User.id` | The user BEING followed |

**Relation names (matching the schema gotcha):**

| Relation | Field | User side |
|----------|-------|-----------|
| "UserFollowers" | `followerId` | `User.followers` — the **follower** side (outbound from that user) |
| "UserFollowings" | `followingId` | `User.followings` — the **followed** side (inbound to that user) |

> **Reading example:** `user.followers` gives all `Follow` rows where `followerId = user.id` — i.e., the people that `user` is following.

---

### 12. `Block`

**Purpose:** Prevents interaction between two users. Blocked users cannot view each other's content or send messages.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `createdAt` | DateTime | `@default(now())` |
| `blockerId` | String | FK → `User.id` — the user who initiated the block |
| `blockedId` | String | FK → `User.id` — the user who is blocked |

**Constraints:** `@@unique([blockerId, blockedId])` — a user can only block another user once.

---

### 13. `Notification`

**Purpose:** Stores every platform alert. A single table covers all event types, discriminated by the `type` enum. Supports read/unread state via `readAt`.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | |
| `type` | NotificationType | enum | Discriminator for the notification variant |
| `recipientId` | String | FK → `User.id` "ReceivedNotifications" | The user who receives this notification |
| `actorId` | String | FK → `User.id` "SentNotifications" | The user whose action triggered this notification |
| `postId` | Int? | FK → `Post.id` nullable | Linked post (null for FOLLOW-type notifications) |
| `readAt` | DateTime? | nullable | Null = unread; set when user views the notification |
| `createdAt` | DateTime | `@default(now())` | |

**Type → postId relationship:**

| Type | `postId` present? |
|------|------------------|
| LIKE, REPLY, REPOST, MENTION | Yes — the affected post |
| COMMUNITY_POST | Yes — the pending post |
| COMMUNITY_NEW_POST | Yes — the approved post |
| COMMUNITY_MOD_ADDED | No |
| FOLLOW | No |
| REPORT | Yes — the reported post |

---

### 14. `Report`

**Purpose:** Moderation flagging — allows users to report posts for rule violations. Admins/mods review and close reports.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `createdAt` | DateTime | `@default(now())` |
| `reason` | String | Free-text reason from the reporter |
| `status` | ReportStatus | `@default(OPEN)` — `OPEN` or `CLOSED` |
| `reporterId` | String | FK → `User.id` |
| `postId` | Int | FK → `Post.id` |

---

### 15. `Conversation`

**Purpose:** Container record for a private-message thread between two or more users. The conversation itself holds no message content — it is purely a grouping record.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Outgoing relations:**

| Field | Points to | Purpose |
|-------|-----------|---------|
| `members` | `ConversationMember[]` | Participants in this thread |
| `messages` | `Message[]` | All messages in this thread |

---

### 16. `ConversationMember`

**Purpose:** Join table linking `User` ↔ `Conversation`. Also stores the last-read cursor for unread message count calculations.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `conversationId` | Int | PK (composite), FK → `Conversation.id` | |
| `userId` | String | PK (composite), FK → `User.id` | |
| `lastReadAt` | DateTime | `@default(now())` | Updated when the user opens the conversation; messages with `createdAt > lastReadAt` are "unread" |

**PK:** `@@id([conversationId, userId])` — a user appears once per conversation.

---

### 17. `Message`

**Purpose:** A single message sent within a Conversation. Supports text body, a single media attachment, or both.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | |
| `conversationId` | Int | FK → `Conversation.id` | |
| `senderId` | String | FK → `User.id` | |
| `body` | String? | `@db.VarChar(1000)` nullable | Text content; null for media-only messages |
| `mediaUrl` | String? | nullable | Single media URL; null for text-only messages |
| `createdAt` | DateTime | `@default(now())` | |

---

### 18. `Community`

**Purpose:** A subreddit-style group where members post content, mods manage it, and rules are defined. Identified externally by `slug`.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `name` | String | Display name (not unique) |
| `slug` | String | `@unique` — URL-safe identifier used in routes |
| `description` | String? | `@db.VarChar(255)` nullable |
| `img` | String? | Avatar image |
| `cover` | String? | Cover/banner image |
| `createdAt` | DateTime | `@default(now())` |
| `updatedAt` | DateTime | `@updatedAt` |

**Outgoing relations:**

| Field | Points to |
|-------|-----------|
| `members` | `CommunityMember[]` |
| `posts` | `Post[]` |
| `rules` | `CommunityRule[]` |
| `bans` | `CommunityBannedUser[]` |

**Business rule:** Deleting a Community is done inside a `prisma.$transaction` (atomic) to clean up members, posts, rules, and bans together.

---

### 19. `CommunityMember`

**Purpose:** Join table for User ↔ Community membership. Stores the user's role within that specific community.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | Surrogate key (join tables usually use composite PK; here a surrogate is used for easy referencing) |
| `role` | CommunityRole | `@default(MEMBER)` | `MEMBER`, `MOD`, or `OWNER` |
| `createdAt` | DateTime | `@default(now())` | |
| `userId` | String | FK → `User.id` | |
| `communityId` | Int | FK → `Community.id` | |

**Constraints:** `@@unique([userId, communityId])` — a user can only have one membership record per community.

---

### 20. `CommunityRule`

**Purpose:** A single rule document belonging to a Community (e.g., "Be respectful", "No spam"). Communities can have multiple rules.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `title` | String | Rule headline |
| `description` | String? | `@db.VarChar(500)` nullable — extended rule text |
| `communityId` | Int | FK → `Community.id` |

---

### 21. `CommunityBannedUser`

**Purpose:** Community-scoped ban — a user banned from a specific community cannot post in it, but can still use the rest of the platform (unless also globally banned via `User.banned`).

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `createdAt` | DateTime | `@default(now())` |
| `reason` | String? | nullable — optional ban reason provided by the mod |
| `userId` | String | FK → `User.id` |
| `communityId` | Int | FK → `Community.id` |

**Constraints:** `@@unique([userId, communityId])` — a user can only be banned once per community.

---

### 22. `Comment`

**Purpose:** Threaded replies to a Post. Supports nesting through a parent-child self-relation.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | |
| `body` | String | `@db.VarChar(1000)` | Text content |
| `createdAt` | DateTime | `@default(now())` | |
| `updatedAt` | DateTime | `@updatedAt` | |
| `deletedAt` | DateTime? | nullable | Soft delete |
| `userId` | String | FK → `User.id` | Author |
| `postId` | Int | FK → `Post.id` | Parent post |
| `parentCommentId` | Int? | FK → `Comment.id` | Parent comment for nested replies |

**Outgoing relations:** `media CommentMedia[]`, `likes CommentLike[]`, `mentions Mention[]`, `notifications Notification[]`.

---

### 23. `CommentMedia`

**Purpose:** Stores image/video/file attachments for a Comment.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `url` | String | |
| `type` | String | `"IMAGE"` \| `"VIDEO"` \| `"FILE"` |
| `height` | Int? | |
| `width` | Int? | |
| `commentId` | Int | FK → `Comment.id` |
| `createdAt` | DateTime | `@default(now())` |

---

### 24. `CommentLike`

**Purpose:** Records a user liking a comment.

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | Int | PK, autoincrement |
| `createdAt` | DateTime | `@default(now())` |
| `userId` | String | FK → `User.id` |
| `commentId` | Int | FK → `Comment.id` |

**Constraints:** `@@unique([userId, commentId])` — a user can like a comment only once.

---

### 25. `Mention`

**Purpose:** Records a user being mentioned (`@username`) in either a Post or a Comment.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | Int | PK, autoincrement | |
| `createdAt` | DateTime | `@default(now())` | |
| `postId` | Int? | FK → `Post.id` | The post where mention occurred |
| `commentId` | Int? | FK → `Comment.id` | The comment where mention occurred |
| `userId` | String | FK → `User.id` | The user who was mentioned |
| `username` | String | | Stored directly for convenience |

---

## Entity-Relationship Diagram

```mermaid
erDiagram
    USER {
        string  id          PK
        string  email       UK
        string  username    UK
        string  password
        datetime emailVerified
        string  displayName
        string  bio
        string  img
        string  cover
        enum    role
        boolean banned
    }

    POST {
        int     id          PK
        string  desc
        boolean isSensitive
        boolean isApproved
        datetime deletedAt
        string  userId      FK
        int     rePostId    FK
        int     parentPostId FK
        int     communityId FK
    }

    POST_MEDIA {
        int     id          PK
        string  url
        string  type
        int     height
        int     width
        int     postId      FK
    }

    HASHTAG {
        int     id          PK
        string  tag         UK
    }

    POST_TAG {
        int     postId      PK-FK
        int     hashtagId   PK-FK
    }

    LIKE {
        int     id          PK
        string  userId      FK
        int     postId      FK
    }

    SAVED_POSTS {
        int     id          PK
        string  userId      FK
        int     postId      FK
    }

    FOLLOW {
        int     id          PK
        string  followerId  FK
        string  followingId FK
        boolean notify
    }

    BLOCK {
        int     id          PK
        string  blockerId   FK
        string  blockedId   FK
    }

    NOTIFICATION {
        int     id          PK
        enum    type
        string  recipientId FK
        string  actorId     FK
        int     postId      FK
        datetime readAt
    }

    REPORT {
        int     id          PK
        string  reason
        enum    status
        string  reporterId  FK
        int     postId      FK
    }

    CONVERSATION {
        int     id          PK
    }

    CONVERSATION_MEMBER {
        int     conversationId PK-FK
        string  userId         PK-FK
        datetime lastReadAt
    }

    MESSAGE {
        int     id          PK
        int     conversationId FK
        string  senderId    FK
        string  body
        string  mediaUrl
    }

    COMMUNITY {
        int     id          PK
        string  name
        string  slug        UK
        string  description
        string  img
        string  cover
    }

    COMMUNITY_MEMBER {
        int     id          PK
        string  userId      FK
        int     communityId FK
        enum    role
    }

    COMMUNITY_RULE {
        int     id          PK
        string  title
        string  description
        int     communityId FK
    }

    COMMUNITY_BANNED_USER {
        int     id          PK
        string  userId      FK
        int     communityId FK
        string  reason
    }

    VERIFICATION_TOKEN {
        string  identifier  PK
        string  token       PK-UK
        datetime expires
    }

    COMMENT {
        int     id          PK
        string  body
        int     userId      FK
        int     postId      FK
        int     parentCommentId FK
    }

    COMMENT_MEDIA {
        int     id          PK
        string  url
        string  type
        int     commentId   FK
    }

    COMMENT_LIKE {
        int     id          PK
        string  userId      FK
        int     commentId   FK
    }

    MENTION {
        int     id          PK
        string  userId      FK
        int     postId      FK
        int     commentId   FK
        string  username
    }

    %% ── User social graph ──────────────────────────────
    USER ||--o{ POST                   : "creates"
    USER ||--o{ LIKE                   : "gives"
    USER ||--o{ SAVED_POSTS            : "bookmarks"
    USER ||--o{ FOLLOW                 : "follows (as follower)"
    USER ||--o{ FOLLOW                 : "followed by (as following)"
    USER ||--o{ BLOCK                  : "blocks"
    USER ||--o{ NOTIFICATION           : "receives"
    USER ||--o{ NOTIFICATION           : "triggers"
    USER ||--o{ REPORT                 : "files"

    %% ── Post content ────────────────────────────────────
    POST ||--o{ POST_MEDIA             : "has media"
    POST ||--o{ LIKE                   : "receives"
    POST ||--o{ SAVED_POSTS            : "bookmarked in"
    POST ||--o{ POST_TAG               : "tagged with"
    POST ||--o{ NOTIFICATION           : "referenced by"
    POST ||--o{ REPORT                 : "reported via"
    POST ||--o{ COMMENT                : "has comments"
    POST ||--o{ MENTION                : "has mentions"
    POST }o--o| POST                   : "repost of"
    POST }o--o| POST                   : "reply to"
    POST }o--o| COMMUNITY              : "posted in"

    %% ── Comments & Mentions ─────────────────────────────
    COMMENT ||--o{ COMMENT_MEDIA       : "has media"
    COMMENT ||--o{ COMMENT_LIKE        : "receives"
    COMMENT ||--o{ MENTION             : "has mentions"
    COMMENT }o--o| COMMENT             : "reply to"
    USER ||--o{ COMMENT                : "writes"
    USER ||--o{ COMMENT_LIKE           : "gives"
    USER ||--o{ MENTION                : "mentioned in"

    %% ── Hashtags ────────────────────────────────────────
    HASHTAG ||--o{ POST_TAG            : "used in"

    %% ── Messaging ───────────────────────────────────────
    CONVERSATION ||--o{ CONVERSATION_MEMBER : "has"
    CONVERSATION ||--o{ MESSAGE             : "contains"
    USER ||--o{ CONVERSATION_MEMBER         : "participates"
    USER ||--o{ MESSAGE                     : "sends"

    %% ── Communities ─────────────────────────────────────
    COMMUNITY ||--o{ COMMUNITY_MEMBER       : "has member"
    COMMUNITY ||--o{ COMMUNITY_RULE         : "has rule"
    COMMUNITY ||--o{ COMMUNITY_BANNED_USER  : "bans"
    USER ||--o{ COMMUNITY_MEMBER            : "joins"
    USER ||--o{ COMMUNITY_BANNED_USER       : "banned from"
```

---

## Key Design Decisions & Gotchas

### 1. Follow relation naming is reversed
`User.followers` (relation "UserFollowers", field `followerId`) = outbound follows — **people this user IS following**.  
`User.followings` (relation "UserFollowings", field `followingId`) = inbound follows — **people who follow this user**.  
This is counter-intuitive; always verify with the relation name, not the field name.

### 2. Soft deletes on Post
`Post.deletedAt` is set instead of hard-deleting. All queries must filter `deletedAt: null` to exclude deleted posts. `PostMedia` rows are **not** cascade-deleted on soft delete — only on a physical row deletion.

### 3. PostMedia type is a plain String, not a Prisma enum
`PostMedia.type` stores `"IMAGE"`, `"VIDEO"`, or `"FILE"` as a raw string. There is no DB-level enum constraint for this column.

### 4. Like has no unique constraint
`Like` has no `@@unique([userId, postId])`. Duplicate-like prevention is entirely application-layer logic.

### 5. Account and Session are unused boilerplate
The `Account` and `Session` models exist from an initial NextAuth setup. The project migrated to custom JWT (`breadit_session` httpOnly cookie, signed with HS256 via `jose`, 30-day expiry). These tables exist in the DB but receive no writes.

### 6. VerificationToken serves two purposes
The same `VerificationToken` table handles both email-OTP verification (6-digit string, 15-min TTL, `identifier = "email-verify:<userId>"`) and password-reset links (UUID token, 1-hour TTL, `identifier = "password-reset:<userId>"`). The prefix in `identifier` disambiguates them.

### 7. CommunityMember uses a surrogate PK
Unlike `PostTag` and `ConversationMember` which use composite PKs, `CommunityMember` has an `id` autoincrement PK plus a `@@unique([userId, communityId])` constraint. The `COMMUNITY_NEW_POST` and `COMMUNITY_POST` notification flows iterate over `CommunityMember` records to fan out notifications.

### 8. isApproved flow
When a community requires post approval, new posts are created with `isApproved: false`. A `COMMUNITY_POST` notification is sent to all mods. When a mod approves, `isApproved` is set to `true` and `COMMUNITY_NEW_POST` notifications fan out to all community members.

### 9. Message body and mediaUrl are both optional
A `Message` can be text-only (`body` set, `mediaUrl` null), media-only (`mediaUrl` set, `body` null), or both. At least one must be present — enforced at the application layer, not by DB constraints.

### 10. Community deletion is atomic
Deleting a Community uses `prisma.$transaction` to atomically remove all associated `CommunityBannedUser`, `CommunityRule`, `CommunityMember`, and `Post` records before deleting the `Community` row itself, avoiding FK constraint violations.
