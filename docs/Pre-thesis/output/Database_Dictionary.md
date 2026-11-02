# Data Dictionary - Breadit

Below is the detailed specification of all 25 database tables, organized into **5 Business Domains** aligned with the system architecture.

| # | Domain | Tables | Count |
|:---:|:---|:---|:---:|
| 1 | Identity & Access | User, Account, Session, VerificationToken | 4 |
| 2 | Content | Post, PostMedia, Comment, CommentMedia, Hashtag, PostTag | 6 |
| 3 | Social Engagement | Follow, Block, Like, CommentLike, SavedPosts, Mention | 6 |
| 4 | Community & Moderation | Community, CommunityMember, CommunityRule, CommunityBannedUser | 4 |
| 5 | Communication | Conversation, ConversationMember, Message, Notification, Report | 5 |

---

## 1. Identity & Access Domain

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• User</b><br><br>
      <b>Description:</b> Core entity representing every platform account, storing identity, profile, and system-level access state.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, String, cuid)</li>
        <li><code>email</code> (String, unique)</li>
        <li><code>username</code> (String, unique)</li>
        <li><code>password</code> (String, nullable) — Null when using OAuth</li>
        <li><code>emailVerified</code> (DateTime, nullable) — Set after OTP confirmed</li>
        <li><code>displayName</code> (String, nullable)</li>
        <li><code>bio</code> (String, nullable)</li>
        <li><code>location</code> (String, nullable)</li>
        <li><code>job</code> (String, nullable)</li>
        <li><code>website</code> (String, nullable)</li>
        <li><code>img</code> (String, nullable) — Avatar URL</li>
        <li><code>cover</code> (String, nullable) — Cover photo URL</li>
        <li><code>role</code> (Enum: USER | ADMIN) — System-level RBAC</li>
        <li><code>banned</code> (Boolean, default: false) — Platform-wide ban flag, set by Admin</li>
        <li><code>createdAt</code> / <code>updatedAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>One-to-Many with nearly all other tables (Post, Comment, Like, Follow, etc.)</li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• VerificationToken</b><br><br>
      <b>Description:</b> Stores single-use OTP codes for email verification and password reset flows. Automatically deleted after use or expiry.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>identifier</code> (PK, String) — Namespaced key, e.g. <code>email-verify:user@x.com</code> or <code>password-reset:user@x.com</code></li>
        <li><code>token</code> (PK, String, unique) — The OTP code or UUID reset token</li>
        <li><code>expires</code> (DateTime) — OTP expires in 15 min; reset link in 1 hour</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>No explicit FK — decoupled from User intentionally for security (avoids leaking whether an email exists)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Account</b> <i>(Reserved — OAuth)</i><br><br>
      <b>Description:</b> NextAuth.js OAuth provider link table. Reserved for future Google / GitHub login integration. Not used in the current custom JWT auth flow.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, String, cuid)</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>type</code> (String) — OAuth grant type</li>
        <li><code>provider</code> (String) — e.g. "google", "github"</li>
        <li><code>providerAccountId</code> (String) — External user ID from provider</li>
        <li><code>access_token</code>, <code>refresh_token</code>, <code>id_token</code> (String, nullable)</li>
        <li><code>expires_at</code> (Int, nullable), <code>token_type</code>, <code>scope</code>, <code>session_state</code></li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> (Cascade delete)</li>
        <li>Unique constraint on <code>[provider, providerAccountId]</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• Session</b> <i>(Reserved — OAuth)</i><br><br>
      <b>Description:</b> NextAuth.js database-backed session table. Reserved for future stateful session support if the auth strategy is extended beyond the current JWT approach.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, String, cuid)</li>
        <li><code>sessionToken</code> (String, unique) — Opaque session identifier</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>expires</code> (DateTime) — Session expiry timestamp</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> (Cascade delete)</li>
      </ul>
    </td>
  </tr>
</table>

---

## 2. Content Domain

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Post</b><br><br>
      <b>Description:</b> The backbone of the feed. Represents original posts, reposts, and quote-reposts through self-referencing. Can optionally belong to a Community.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int, auto-increment)</li>
        <li><code>userId</code> (FK, String) — The author</li>
        <li><code>communityId</code> (FK, Int, nullable) — Community it belongs to</li>
        <li><code>desc</code> (String, nullable, max 255) — Text content</li>
        <li><code>isSensitive</code> (Boolean, default: false) — NSFW flag</li>
        <li><code>isApproved</code> (Boolean, default: true) — Set to false when posted to a community with approval required; Mod approves</li>
        <li><code>rePostId</code> (FK, Int, nullable) — Points to the original post if this is a plain repost</li>
        <li><code>parentPostId</code> (FK, Int, nullable) — Used for quote-reposts and reply threading</li>
        <li><code>deletedAt</code> (DateTime, nullable) — Soft delete flag (set by owner or Admin)</li>
        <li><code>createdAt</code> / <code>updatedAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Self-referencing for reposts and threading</li>
        <li>Many-to-One with <code>User</code>, <code>Community</code></li>
        <li>One-to-Many with <code>PostMedia</code>, <code>Comment</code>, <code>Like</code>, <code>SavedPosts</code>, <code>PostTag</code>, <code>Notification</code>, <code>Report</code>, <code>Mention</code></li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• PostMedia</b><br><br>
      <b>Description:</b> Stores image and video attachments for a Post. A single post can have multiple media files.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>postId</code> (FK, Int)</li>
        <li><code>url</code> (String) — CDN path (Cloudinary/S3)</li>
        <li><code>type</code> (String) — "IMAGE" | "VIDEO" | "FILE"</li>
        <li><code>width</code>, <code>height</code> (Int, nullable) — Used for layout rendering</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Post</code> (Cascade delete)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Comment</b><br><br>
      <b>Description:</b> User replies to a Post. Supports nested comment threads via self-referencing on <code>parentCommentId</code>.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String) — Author</li>
        <li><code>postId</code> (FK, Int) — Parent post</li>
        <li><code>parentCommentId</code> (FK, Int, nullable) — Parent comment for nested replies</li>
        <li><code>body</code> (String, max 1000) — Comment text</li>
        <li><code>deletedAt</code> (DateTime, nullable) — Soft delete</li>
        <li><code>createdAt</code> / <code>updatedAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Self-referencing for nested comment trees</li>
        <li>Many-to-One with <code>User</code>, <code>Post</code></li>
        <li>One-to-Many with <code>CommentMedia</code>, <code>CommentLike</code>, <code>Mention</code>, <code>Notification</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• CommentMedia</b><br><br>
      <b>Description:</b> File attachments embedded inside comments.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>commentId</code> (FK, Int)</li>
        <li><code>url</code> (String) — CDN path</li>
        <li><code>type</code> (String) — "IMAGE" | "VIDEO" | "FILE"</li>
        <li><code>width</code>, <code>height</code> (Int, nullable)</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Comment</code> (Cascade delete)</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Hashtag</b><br><br>
      <b>Description:</b> Normalized registry of unique tags (stored lowercase). Powers the Trending / Explore feature by aggregating post counts per tag.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>tag</code> (String, unique) — Lowercase tag string, e.g. "technology"</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>One-to-Many with <code>PostTag</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• PostTag</b><br><br>
      <b>Description:</b> Join table resolving the Many-to-Many relationship between Posts and Hashtags. Created/updated automatically when a post is submitted or edited.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>postId</code> (PK, FK, Int)</li>
        <li><code>hashtagId</code> (PK, FK, Int)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Composite PK of two FKs — no extra data needed</li>
      </ul>
    </td>
  </tr>
</table>

---

## 3. Social Engagement Domain

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Follow</b><br><br>
      <b>Description:</b> Directed social graph edge. Determines which users appear in the personalized home feed of the follower.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>followerId</code> (FK, String) — The user initiating the follow</li>
        <li><code>followingId</code> (FK, String) — The user being followed</li>
        <li><code>notify</code> (Boolean, default: false) — Push notification preference for this specific follow</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> twice (follower and following sides)</li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• Block</b><br><br>
      <b>Description:</b> Mutual blacklist between two users. Prevents all interactions (follow, message, view posts). Automatically removes existing follows between both parties.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>blockerId</code> (FK, String) — The user initiating the block</li>
        <li><code>blockedId</code> (FK, String) — The user being blocked</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> twice</li>
        <li>Unique constraint on <code>[blockerId, blockedId]</code></li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Like</b><br><br>
      <b>Description:</b> Records a User's "like" reaction on a Post. Triggers a LIKE notification to the post author.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>postId</code> (FK, Int)</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Post</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• CommentLike</b><br><br>
      <b>Description:</b> Records a User's "like" reaction on a Comment. Unique constraint prevents double-liking.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>commentId</code> (FK, Int)</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Comment</code> (Cascade delete)</li>
        <li>Unique constraint on <code>[userId, commentId]</code></li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• SavedPosts</b><br><br>
      <b>Description:</b> User's personal bookmark list. Posts saved here appear in the /bookmarks page.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>postId</code> (FK, Int)</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Post</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• Mention</b><br><br>
      <b>Description:</b> Records every @username tag inside a post or comment body. Parsed automatically on create/edit. Triggers a MENTION notification to the tagged user.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String) — The user being mentioned</li>
        <li><code>username</code> (String) — Stored denormalized for fast retrieval</li>
        <li><code>postId</code> (FK, Int, nullable) — Source post</li>
        <li><code>commentId</code> (FK, Int, nullable) — Source comment</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Post</code>, <code>Comment</code> (Cascade delete)</li>
      </ul>
    </td>
  </tr>
</table>

---

## 4. Community & Moderation Domain

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Community</b><br><br>
      <b>Description:</b> A subreddit-style group — a shared space for members with a common interest. Created by any verified user who becomes the Owner.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>slug</code> (String, unique) — URL identifier, e.g. <code>breadit.com/c/technology</code></li>
        <li><code>name</code> (String) — Display name</li>
        <li><code>description</code> (String, nullable, max 255)</li>
        <li><code>img</code> (String, nullable) — Community avatar</li>
        <li><code>cover</code> (String, nullable) — Cover banner</li>
        <li><code>createdAt</code> / <code>updatedAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>One-to-Many with <code>Post</code>, <code>CommunityMember</code>, <code>CommunityRule</code>, <code>CommunityBannedUser</code></li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• CommunityMember</b><br><br>
      <b>Description:</b> Junction table connecting Users to Communities. Stores each member's role, enabling community-level RBAC (Member / Mod / Owner).<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String)</li>
        <li><code>communityId</code> (FK, Int)</li>
        <li><code>role</code> (Enum: MEMBER | MOD | OWNER, default: MEMBER)</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Community</code></li>
        <li>Unique constraint on <code>[userId, communityId]</code> — one role per user per community</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• CommunityRule</b><br><br>
      <b>Description:</b> Custom rules set by the community Owner/Moderator, displayed to members for content guidelines.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>communityId</code> (FK, Int)</li>
        <li><code>title</code> (String) — Rule headline</li>
        <li><code>description</code> (String, nullable, max 500) — Rule detail</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Community</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• CommunityBannedUser</b><br><br>
      <b>Description:</b> Community-level blacklist enforced by Moderators/Owners. Prevents the banned user from rejoining or posting in that community. Distinct from the platform-wide <code>User.banned</code> flag managed by Admin.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>userId</code> (FK, String) — The banned user</li>
        <li><code>communityId</code> (FK, Int)</li>
        <li><code>reason</code> (String, nullable) — Ban reason note</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code>, <code>Community</code></li>
        <li>Unique constraint on <code>[userId, communityId]</code></li>
      </ul>
    </td>
  </tr>
</table>

---

## 5. Communication Domain

<table>
  <tr>
    <td valign="top" width="50%">
      <b>• Conversation</b><br><br>
      <b>Description:</b> Represents a single 1-to-1 Direct Message thread between two users. A conversation is created once and reused for all subsequent messages between the same pair.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>createdAt</code> (DateTime)</li>
        <li><code>updatedAt</code> (DateTime) — Bumped on every new message; used to sort inbox by latest activity</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>One-to-Many with <code>ConversationMember</code>, <code>Message</code></li>
      </ul>
    </td>
    <td valign="top" width="50%">
      <b>• ConversationMember</b><br><br>
      <b>Description:</b> Junction table linking Users to Conversations. Tracks each participant's last-read timestamp, which powers the unread message badge count.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>conversationId</code> (PK, FK, Int)</li>
        <li><code>userId</code> (PK, FK, String)</li>
        <li><code>lastReadAt</code> (DateTime, default: now()) — Messages newer than this are considered "unread"</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Composite PK ensures a user appears only once per conversation</li>
        <li>Many-to-One with <code>Conversation</code>, <code>User</code></li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Message</b><br><br>
      <b>Description:</b> Individual message sent within a Conversation. Delivered in real-time via Socket.IO. Supports text and media attachments.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>conversationId</code> (FK, Int)</li>
        <li><code>senderId</code> (FK, String)</li>
        <li><code>body</code> (String, nullable, max 1000) — Text content</li>
        <li><code>mediaUrl</code> (String, nullable) — Image/file attachment URL</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>Conversation</code>, <code>User</code></li>
      </ul>
    </td>
    <td valign="top">
      <b>• Notification</b><br><br>
      <b>Description:</b> System-generated alert delivered to a recipient user when a relevant action occurs. Pushed in real-time via Socket.IO and persisted for the inbox view.<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>recipientId</code> (FK, String) — Who receives the alert</li>
        <li><code>actorId</code> (FK, String) — Who triggered the action</li>
        <li><code>type</code> (Enum: LIKE | REPLY | REPOST | FOLLOW | MENTION | COMMUNITY_POST | COMMUNITY_NEW_POST | COMMUNITY_MOD_ADDED | REPORT)</li>
        <li><code>postId</code> (FK, Int, nullable) — Related post</li>
        <li><code>commentId</code> (FK, Int, nullable) — Related comment</li>
        <li><code>readAt</code> (DateTime, nullable) — Null = unread; set when user opens notification</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> (recipient + actor), <code>Post</code>, <code>Comment</code></li>
      </ul>
    </td>
  </tr>
  <tr>
    <td valign="top">
      <b>• Report</b><br><br>
      <b>Description:</b> Content flagging system. Any user can submit a report against a Post. System Admins review the report queue and take action (dismiss or delete the post).<br><br>
      <b>Fields:</b>
      <ul>
        <li><code>id</code> (PK, Int)</li>
        <li><code>reporterId</code> (FK, String) — The user who submitted the report</li>
        <li><code>postId</code> (FK, Int) — The flagged post</li>
        <li><code>reason</code> (String) — Report reason text (e.g., "Spam", "Hate speech")</li>
        <li><code>status</code> (Enum: OPEN | CLOSED, default: OPEN)</li>
        <li><code>createdAt</code> (DateTime)</li>
      </ul>
      <b>Relationships:</b>
      <ul>
        <li>Many-to-One with <code>User</code> (reporter), <code>Post</code></li>
      </ul>
    </td>
    <td valign="top">
    </td>
  </tr>
</table>
