# 5. Test Cases

## 5.1. Detailed Cases:
- **Author:** Cao Ngọc Anh Tuấn
- **Date:** May 30, 2026
- **System:** Breadit Social Web Platform

This document contains comprehensive test cases for the Breadit system, covering all major features and workflows based on actual system implementation.

**Reference Test Accounts:**
- **User:** user1@example.com / password
- **Admin:** admin@breadit.dev / 123456

---

## 5.2. Authentication & Account Verification (FR-AUTH)

This section demonstrates the core authentication flows. Registration and login are the entry points for all platform features. These endpoints are rate-limited (`@Throttle`: 10 requests per 60 seconds) and use bcrypt for secure password handling.

---

### 5.2.1 &emsp; Test Case #: UC-01

- **Test Case Name:** Register Account
- **System:** Breadit
- **Subsystem:** Authentication & Account Verification
- **Short Description:**
  - User registers a new account by providing a unique username, email address, and a strong password. The system validates all inputs, hashes the password with bcrypt (10 salt rounds), and dispatches a 6-digit OTP to the provided email.

- **Pre-conditions:**
  - No existing account with the provided email or username in the database
  - SMTP email service is configured in the backend environment
  - The `/sign-up` page is accessible

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Submit registration form at `/sign-up` | Calls register API | Pass | |
| 02 | System validates inputs | Checks format and password strength | Pass | |
| 03 | System checks duplicate | Queries DB (returns 409 if duplicate) | Pass | |
| 04 | System hashes password & saves user | bcrypt (10 rounds); saves User record | Pass | Bcrypt 10 rounds |
| 05 | System sends OTP & redirects | Stores token, sends email, redirects | Pass | OTP valid for 15m |

- **Post-condition:**
  - A new `User` record exists in the database with `emailVerified = null`
  - A `VerificationToken` row is stored
  - User's inbox contains a verification email with the 6-digit OTP

---

### 5.2.2 &emsp; Test Case #: UC-02

- **Test Case Name:** Verify Email Address
- **System:** Breadit
- **Subsystem:** Authentication & Account Verification
- **Short Description:**
  - After registering, user submits the 6-digit OTP received by email to verify their account. The system validates the code and its expiry, marks the email as verified, and issues a `breadit_session` session cookie.

- **Pre-conditions:**
  - User has completed registration (UC-01) and `emailVerified` is `null`
  - A valid 6-digit `VerificationToken` was sent to the user's email and has not yet expired (15-minute window)
  - User is on the `/verify` page

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Submit OTP at `/verify` | Calls verify API | Pass | |
| 02 | System retrieves token | Queries DB for token | Pass | |
| 03 | System checks expiration | Verifies token is within 15m | Pass | |
| 04 | System updates user status | Sets `emailVerified` to current time | Pass | Verify timestamp |
| 05 | System clears token & redirects | Deletes token; sets cookie; redirects | Pass | 30-day JWT cookie |

- **Post-condition:**
  - `User.emailVerified` is set to a timestamp in the database
  - `VerificationToken` row is deleted
  - User can create posts, like, follow, and access all protected features
  - `breadit_session` cookie is active in the browser

---

### 5.2.3 &emsp; Test Case #: UC-04

- **Test Case Name:** Log In with Email and Password
- **System:** Breadit
- **Subsystem:** Authentication & Account Verification
- **Short Description:**
  - User logs into the system using a registered email and password. The system validates credentials via bcrypt comparison and issues a JWT `breadit_session` httpOnly cookie on success.

- **Pre-conditions:**
  - A user account with the provided email exists in the database
  - User's email is verified (`emailVerified` is not null)
  - The `/sign-in` page is accessible

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Submit credentials at `/sign-in` | Calls login API | Pass | |
| 02 | System queries user | Finds user by email | Pass | |
| 03 | System compares password | Compares bcrypt hash | Pass | |
| 04 | System generates JWT | Creates token with claims | Pass | |
| 05 | System sets session cookie | Sets `breadit_session` cookie (30-day) | Pass | httpOnly cookie |
| 06 | System redirects to `/` | Redirects to homepage `/` | Pass | |

- **Post-condition:**
  - `breadit_session` httpOnly cookie is active in the browser
  - User can access all protected routes
  - User is redirected to the home feed at `/`

---

## 5.3. Feeds & Discovery (FR-DISC)

This section demonstrates how users discover content. The home feed shows posts from followed users; the explore feed surfaces trending content ranked by a time-decay engagement algorithm with author-diversity enforcement. Global search spans posts, users, hashtags, and communities.

---

### 5.3.1 &emsp; Test Case #: UC-26

- **Test Case Name:** View Home Feed (For You)
- **System:** Breadit
- **Subsystem:** Feeds & Discovery
- **Short Description:**
  - Authenticated user views a personalized home feed containing top-level posts from themselves and followed users, ordered by most recent. Community posts and replies are excluded. Blocked users are filtered out.

- **Pre-conditions:**
  - User is authenticated
  - User follows at least one other user who has published posts
  - Posts exist in the system

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click "For you" or navigate to `/` | Calls feed API with token | Pass | |
| 02 | System validates request | `OptionalJwtAuthGuard` checks auth | Pass | |
| 03 | System filters posts | Queries posts from self/followees | Pass | Exclude replies |
| 04 | System sorts and paginates | Orders by `createdAt` desc (limit 3) | Pass | |
| 05 | Frontend displays feed | Renders post list with scroll pagination | Pass | |

- **Post-condition:**
  - User sees a personalized feed sorted by most recent
  - Interaction state (liked, saved, reposted) is correct per post

---

### 5.3.2 &emsp; Test Case #: UC-27

- **Test Case Name:** View Explore Feed (Discover)
- **System:** Breadit
- **Subsystem:** Feeds & Discovery
- **Short Description:**
  - User views the explore feed, which surfaces globally trending posts ranked by a time-decay engagement score. Author-diversity is enforced (max 3 posts per author per page).

- **Pre-conditions:**
  - Posts exist in the system created within the last 7 days
  - User may be authenticated or a guest

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click "Explore" tab | Calls explore feed API | Pass | |
| 02 | System filters posts | Gets top-level posts from last 7 days | Pass | Last 7 days posts |
| 03 | System computes scores | Calculates time-decay score | Pass | |
| 04 | System applies diversity cap | Restricts to max 3 posts per author | Pass | Max 3 posts/author |
| 05 | System paginates feed | Returns ranked posts with cursor | Pass | |
| 06 | Frontend displays posts | Renders explore feed; loads on scroll | Pass | |

- **Post-condition:**
  - User sees a trending feed ranked by engagement quality
  - No single author has more than 3 posts visible on one page

---

### 5.3.3 &emsp; Test Case #: UC-30

- **Test Case Name:** Global Search
- **System:** Breadit
- **Subsystem:** Feeds & Discovery
- **Short Description:**
  - User submits a search query and receives multi-type results: matching posts, users, hashtags, and communities (up to 5 each). Queries run in parallel; results are block-filtered for authenticated users.

- **Pre-conditions:**
  - Search query string `q` is non-empty (at least 1 character)
  - User may be authenticated or a guest

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Enter query in search bar | Calls search API | Pass | |
| 02 | System checks credentials | `OptionalJwtAuthGuard` runs (guests allowed) | Pass | |
| 03 | System runs searches | Runs parallel queries on posts, users, tags, communities | Pass | Parallel searches |
| 04 | System filters content | Excludes deleted/banned/blocked items | Pass | |
| 05 | System groups results | Returns up to 5 items per category | Pass | |
| 06 | Frontend renders results | Displays lists; navigates on click | Pass | |

- **Post-condition:**
  - Multi-type search results displayed in sections
  - Clicking a result navigates to the post permalink, user profile, hashtag feed, or community page

---

## 5.4. Post Management (FR-POST)

This section covers post creation, editing, and deletion. All post mutations go through a unified multipart endpoint that handles both text content and media files. Soft-delete is used to preserve referential integrity.

---

### 5.4.1 &emsp; Test Case #: UC-08

- **Test Case Name:** Create Text Post
- **System:** Breadit
- **Subsystem:** Post Management
- **Short Description:**
  - Authenticated and email-verified user creates a text post from the Share component. The system parses hashtags and @mentions, persists the post, and notifies mentioned users.

- **Pre-conditions:**
  - User is authenticated and email-verified
  - Post description is ≤ 255 characters

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Write text and click "Post" | Submits multipart request | Pass | |
| 02 | System checks text length | Validates description (≤ 255 chars) | Pass | Max 255 characters |
| 03 | System verifies auth status | Guards check session and verification | Pass | |
| 04 | System creates Post | Saves Post record to database | Pass | |
| 05 | System parses hashtags | Creates Hashtag and PostTag rows | Pass | Index hashtags |
| 06 | System parses mentions | Sends Socket.IO notifications to mentioned users | Pass | |
| 07 | Frontend updates feed | Prepends new post to feed | Pass | |

- **Post-condition:**
  - `Post` record exists in the database
  - `#breadit` hashtag is searchable via `/hashtag/breadit` feed
  - `@alice` (if exists) receives a real-time MENTION notification

---

### 5.4.2 &emsp; Test Case #: UC-09

- **Test Case Name:** Create Post with Media (Image/Video)
- **System:** Breadit
- **Subsystem:** Post Management
- **Short Description:**
  - User attaches image or video files to a post. The system processes each file through Cloudinary (or local `sharp` fallback) and creates `PostMedia` rows linked to the post.

- **Pre-conditions:**
  - User is authenticated and email-verified
  - File size ≤ 500 MB per file; at most 10 files per request
  - File is a valid image or video format

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Attach files and click "Post" | Submits multipart request | Pass | Max 10 files, ≤ 500MB |
| 02 | System validates files | Checks file size and mime types | Pass | |
| 03 | System uploads files | Saves to Cloudinary or falls back to Sharp | Pass | Cloudinary/Sharp upload |
| 04 | System creates Post | Saves Post record to database | Pass | |
| 05 | System creates PostMedia | Links media URLs to Post row | Pass | |
| 06 | Frontend renders media | Displays post with media grid | Pass | |

- **Post-condition:**
  - `Post` and `PostMedia` records exist in the database
  - Media is stored in Cloudinary or local `UPLOAD_DIR`
  - Post with media is visible in the feed

---

### 5.4.3 &emsp; Test Case #: UC-13

- **Test Case Name:** Delete Own Post (Soft Delete)
- **System:** Breadit
- **Subsystem:** Post Management
- **Short Description:**
  - User soft-deletes their own post. The system verifies ownership and sets `deletedAt`, hiding the post from all feeds without permanent removal from the database.

- **Pre-conditions:**
  - User is authenticated and owns the post
  - Post exists and `deletedAt` is `null`

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click "Delete" on post | Calls delete post API | Pass | |
| 02 | System checks session | Guards verify session and status | Pass | |
| 03 | System checks owner | Verifies post belongs to request user | Pass | |
| 04 | System soft-deletes post | Sets `deletedAt = now()` in database | Pass | Soft delete |
| 05 | Frontend removes post | Clears post from UI cache | Pass | |

- **Post-condition:**
  - `Post.deletedAt` is set; post is excluded from all feed queries
  - Post hidden from home feed, explore feed, profile tabs, hashtag feeds, and community feeds

---

## 5.5. Post Interaction (FR-INT)

This section covers user engagement actions: liking, commenting (replying), reposting, and bookmarking. All interaction endpoints require authentication; most also require email verification and a non-banned account status.

---

### 5.5.1 &emsp; Test Case #: UC-15

- **Test Case Name:** Like / Unlike Post
- **System:** Breadit
- **Subsystem:** Post Interaction
- **Short Description:**
  - Authenticated user toggles the like state on a post. A LIKE notification is emitted via Socket.IO to the post owner on first like. Clicking again removes the like.

- **Pre-conditions:**
  - User is authenticated, email-verified, and not banned
  - Post exists and is not deleted

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click heart icon on post | Calls like API | Pass | |
| 02 | System verifies auth | Checks auth, verification, and ban status | Pass | |
| 03 | System checks current like | Queries Like table for user/post | Pass | |
| 04 | System toggles Like row | Deletes (unlike) or inserts (like) | Pass | |
| 05 | System sends notification | Emits Socket.IO notification to owner | Pass | Notify post owner |
| 06 | Frontend updates button | Toggles heart fill and counter | Pass | |

- **Post-condition:**
  - `Like` row exists in the database
  - Post owner receives a real-time LIKE notification (if actor ≠ owner)
  - Heart icon is filled; like count incremented by 1

---

### 5.5.2 &emsp; Test Case #: UC-10

- **Test Case Name:** Create Reply / Comment
- **System:** Breadit
- **Subsystem:** Post Interaction
- **Short Description:**
  - User replies to an existing post, creating a threaded comment. The parent post owner receives a REPLY notification. Replies support text and media attachments.

- **Pre-conditions:**
  - User is authenticated and email-verified
  - Parent post exists and is not deleted

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Type reply and click "Reply" | Calls posts API with parent ID | Pass | |
| 02 | System saves reply | Creates reply post; processes media | Pass | Link parent post ID |
| 03 | System sends notification | Emits Socket.IO notification to parent owner | Pass | |
| 04 | System parses mentions | Dispatches notifications to mentioned users | Pass | |
| 05 | Frontend appends reply | Displays reply in comment thread | Pass | |

- **Post-condition:**
  - `Post` record with `parentPostId` set exists in the database
  - Parent post owner receives a real-time REPLY notification
  - Reply is visible in the comment thread below the parent post

---

## 5.6. User Relationship Management (FR-REL)

This section covers the social graph features: following users to customize the home timeline, and blocking users to restrict access. Both operations include real-time feedback and cache invalidation.

---

### 5.6.1 &emsp; Test Case #: UC-18

- **Test Case Name:** Follow / Unfollow User
- **System:** Breadit
- **Subsystem:** User Relationship Management
- **Short Description:**
  - User follows another user to add their posts to the home feed. The target user receives a real-time FOLLOW notification. Clicking the button again unfollows and removes the relationship.

- **Pre-conditions:**
  - Both users exist and are different accounts
  - Follower is authenticated and not banned
  - Follower is viewing the target user's profile page

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click "Follow" on profile | Calls follow API | Pass | |
| 02 | System verifies auth | Guards check session and ban status | Pass | |
| 03 | System checks follow | Queries Follow table | Pass | |
| 04 | System toggles Follow | Inserts follow row or deletes it | Pass | |
| 05 | System sends notification | Emits Socket.IO notification to target | Pass | Real-time follow notification |
| 06 | Home feed cache updates | Clears Redis; updates chronological feed | Pass | |

- **Post-condition:**
  - `Follow` row exists in the database
  - Target user's posts now appear in the follower's home feed
  - Target user received a FOLLOW notification

---

### 5.6.2 &emsp; Test Case #: UC-21

- **Test Case Name:** Block / Unblock User
- **System:** Breadit
- **Subsystem:** User Relationship Management
- **Short Description:**
  - User blocks another user, removing all mutual follow relationships and filtering the blocked user from all feeds, search results, and notifications. The block is bidirectional.

- **Pre-conditions:**
  - Both users exist and are different accounts
  - Acting user is authenticated and not banned

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Select "Block" on profile | Calls block API | Pass | |
| 02 | System verifies auth | Guards check session and ban status | Pass | |
| 03 | System checks block | Queries Block table | Pass | |
| 04 | System toggles Block | Inserts block row or deletes it | Pass | |
| 05 | System removes follows | Deletes mutual follows in both directions | Pass | Delete mutual follows |
| 06 | System filters content | Bidirectionally filters posts and search | Pass | Bidirectional |

- **Post-condition:**
  - `Block` row exists in the database
  - All mutual `Follow` relationships are deleted
  - Blocked user is excluded from feeds, search, and notifications

---

## 5.7. Profile Management (FR-PROF)

This section covers profile viewing and editing. Profiles are rendered via Server-Side Rendering and include block-status checks. Profile updates use a sparse `PATCH` operation so only provided fields are modified.

---

### 5.7.1 &emsp; Test Case #: UC-22

- **Test Case Name:** View User Profile
- **System:** Breadit
- **Subsystem:** Profile Management
- **Short Description:**
  - User navigates to another user's profile. The system checks block status in both directions and returns the full profile with follower/following counts and interaction options.

- **Pre-conditions:**
  - Target user exists and is not banned
  - Viewer may be authenticated or a guest

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Navigate to profile `/:username` | Initiates profile load | Pass | |
| 02 | System fetches user profile | Calls user detail API | Pass | |
| 03 | System checks block | Queries database for mutual block | Pass | |
| 04 | System restricts view | Returns basic details only if blocked | Pass | Restrict post view |
| 05 | System returns full profile | Returns profile fields, counts, and posts | Pass | |
| 06 | Frontend displays profile | Renders header, actions, and tabs | Pass | |

- **Post-condition:**
  - Full profile is rendered to the viewer
  - Viewer can follow, block, message, or browse the target's posts via tabs

---

### 5.7.2 &emsp; Test Case #: UC-23

- **Test Case Name:** Edit Own Profile
- **System:** Breadit
- **Subsystem:** Profile Management
- **Short Description:**
  - User updates their own profile information (display name, bio, location, job, website, avatar, or cover). The system applies only the changed fields using a sparse PATCH update.

- **Pre-conditions:**
  - User is authenticated and not banned
  - User is viewing their own profile page `/:username`

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click "Edit profile" | Opens modal with current values | Pass | |
| 02 | User edits fields | Enforces field limits | Pass | Max 160 characters |
| 03 | Frontend uploads images | Calls upload API; returns URLs | Pass | |
| 04 | Frontend submits PATCH | Sends payload with changed fields | Pass | |
| 05 | System verifies auth | Guards check session and ban status | Pass | |
| 06 | System updates database | Sparse-updates modified fields in User row | Pass | |
| 07 | Frontend renders updates | Returns user object; re-renders profile | Pass | |

- **Post-condition:**
  - `User` record reflects the updated values
  - Profile page immediately shows the new bio, location, and avatar

---

## 5.8. Direct Messaging (FR-MSG)

This section covers 1:1 real-time messaging. Conversations are persisted in the database and delivered in real-time via Socket.IO. Unread message counts are tracked per conversation and displayed as a badge in the sidebar.

---

### 5.8.1 &emsp; Test Case #: UC-40

- **Test Case Name:** Start or Find a Conversation
- **System:** Breadit
- **Subsystem:** Direct Messaging
- **Short Description:**
  - User initiates a direct message thread with another user. If a conversation already exists between the two, the system returns it; otherwise a new one is created.

- **Pre-conditions:**
  - Both users exist and are different accounts
  - Initiating user is authenticated and email-verified

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click Message on profile | Calls conversation API | Pass | |
| 02 | System verifies credentials | Guards check session and verification | Pass | |
| 03 | System checks user ID | Confirms user is not messaging self | Pass | |
| 04 | System searches conversation | Queries database for existing pair | Pass | |
| 05 | System returns conversation | Returns metadata if conversation exists | Pass | |
| 06 | System creates conversation | Atomically inserts conversation & member rows | Pass | |
| 07 | Frontend redirects | Navigates to `/messages/:id` | Pass | Redirect to thread |

- **Post-condition:**
  - `Conversation` and two `ConversationMember` rows exist in the database
  - User is navigated to the message thread at `/messages/:conversationId`

---

### 5.8.2 &emsp; Test Case #: UC-43

- **Test Case Name:** Send Text Message
- **System:** Breadit
- **Subsystem:** Direct Messaging
- **Short Description:**
  - User sends a text message in a conversation. The message is persisted and delivered to the recipient in real-time via Socket.IO. The conversation is bumped to the top of both users' lists.

- **Pre-conditions:**
  - User is authenticated and email-verified
  - User is a `ConversationMember` of the target conversation
  - Message body is ≤ 1000 characters

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Type message and click Send | Inputs text (checks ≤ 1000 limit) | Pass | |
| 02 | Frontend appends message | Renders message instantly in chat UI | Pass | |
| 03 | System checks credentials | Guards check auth, verification, & member role | Pass | |
| 04 | System saves message | Inserts Message row in DB | Pass | |
| 05 | System sends message | Emits `newMessage` Socket.IO event | Pass | Socket.IO broadcast |
| 06 | System updates activity time | Refreshes `Conversation.updatedAt` timestamp | Pass | |
| 07 | System returns message | Returns saved row; swaps UI card | Pass | |

- **Post-condition:**
  - `Message` row persisted in the database
  - Recipient receives the message in real-time via Socket.IO
  - Conversation `updatedAt` is refreshed; conversation appears at the top of both users' lists

---

## 5.9. Real-time Notifications (FR-NOTI)

This section covers the notification system. Notifications for likes, replies, reposts, follows, and mentions are persisted in the database and pushed in real-time via Socket.IO. Redis is used to scale broadcasting across multiple server instances.

---

### 5.9.1 &emsp; Test Case #: UC-37

- **Test Case Name:** View Notification List
- **System:** Breadit
- **Subsystem:** Real-time Notifications
- **Short Description:**
  - Authenticated user views their paginated notification history. Notifications include LIKE, REPLY, REPOST, FOLLOW, MENTION, and COMMUNITY types with read/unread visual indicators.

- **Pre-conditions:**
  - User is authenticated
  - At least one notification exists for the user

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click notifications bell icon | Calls notifications API | Pass | |
| 02 | System validates user session | `JwtAuthGuard` checks credentials | Pass | |
| 03 | System queries notifications | Fetches user notifications with details | Pass | |
| 04 | System sorts and paginates | Orders by `createdAt` desc | Pass | Sort desc, limit 10 |
| 05 | System returns lists | Returns items; frontend renders list | Pass | |
| 06 | Click notification | Calls read API; marks record; navigates | Pass | |

- **Post-condition:**
  - Full notification history is visible to the user
  - Clicked notifications are marked as read (`readAt` set)

---

## 5.10. Community Management (FR-COMM)

This section covers the community lifecycle: creation, membership, and content moderation. Communities use a role hierarchy (OWNER → MOD → MEMBER). Member posts enter a moderation queue and require approval before becoming visible in the community feed.

---

### 5.10.1 &emsp; Test Case #: UC-46

- **Test Case Name:** Create Community
- **System:** Breadit
- **Subsystem:** Community Management
- **Short Description:**
  - Authenticated and email-verified user creates a new community with a unique slug. The creator is automatically assigned the OWNER role and gains full moderation privileges.

- **Pre-conditions:**
  - User is authenticated and email-verified
  - The chosen slug is not already taken by another community

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Fill details and click Create | Submits creation request | Pass | |
| 02 | System validates session | Guards check auth and verification | Pass | |
| 03 | System checks slug | Verifies slug uniqueness | Pass | |
| 04 | System registers community | Creates Community & OWNER member rows | Pass | Assign OWNER role |
| 05 | System returns community | Returns community; redirects to `/c/:slug` | Pass | |

- **Post-condition:**
  - `Community` record exists with the chosen name and slug
  - Creator is the OWNER and can post, manage rules, approve posts, and ban members

---

### 5.10.2 &emsp; Test Case #: UC-49

- **Test Case Name:** Join / Leave Community
- **System:** Breadit
- **Subsystem:** Community Management
- **Short Description:**
  - User toggles membership in a community. Joining creates a MEMBER record and grants the user access to post (with moderation) and view the community feed. Community OWNER cannot leave. Community-banned users are rejected.

- **Pre-conditions:**
  - Community exists and is not deleted
  - User is authenticated and not site-banned
  - User is not community-banned in this community
  - User is not the OWNER of the community

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Click Join/Leave button | Calls join/leave API | Pass | |
| 02 | System verifies status | Guards check session and ban status | Pass | |
| 03 | System checks ban | Rejects if banned from community | Pass | Block if community banned |
| 04 | System checks OWNER role | Rejects leave if user is OWNER | Pass | |
| 05 | System queries membership | Checks if membership exists | Pass | |
| 06 | System toggles membership | Inserts MEMBER row or deletes membership | Pass | |
| 07 | System returns state | Returns joined status; updates UI | Pass | |

- **Post-condition:**
  - `CommunityMember` row exists with `role = MEMBER`
  - User can now submit posts to the community (entering moderation queue if required)
  - User sees the community in their community list

---

### 5.10.3 &emsp; Test Case #: UC-51

- **Test Case Name:** Approve / Reject Community Post
- **System:** Breadit
- **Subsystem:** Community Management
- **Short Description:**
  - Community OWNER or MOD reviews a pending post submitted by a MEMBER. Approving publishes the post to the community feed and notifies all members. Rejecting soft-deletes the post.

- **Pre-conditions:**
  - At least one post with `isApproved = false` exists in the community
  - Acting user is authenticated and has OWNER or MOD role in the community

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Moderator clicks Approve/Reject | Calls moderate API | Pass | |
| 02 | System verifies role | Checks if role is OWNER or MOD | Pass | Verify OWNER/MOD role |
| 03 | System updates post | Sets `isApproved = true` or soft-deletes post | Pass | |
| 04 | System sends notification | Emits `COMMUNITY_NEW_POST` event | Pass | |
| 05 | System returns state | Removes post from queue; updates feed | Pass | |

- **Post-condition:**
  - `Post.isApproved = true`; post is visible in the community feed (`/c/:slug`)
  - All community members receive a real-time COMMUNITY_NEW_POST notification

---

## 5.11. Administrative Moderation (FR-MOD)

This section covers the admin console features. Administrators have site-wide authority to manage users (ban/unban) and handle content reports. All admin routes are protected by both `JwtAuthGuard` and `RolesGuard` requiring `role = ADMIN`.

---

### 5.11.1 &emsp; Test Case #: UC-62

- **Test Case Name:** Ban / Unban User (Admin)
- **System:** Breadit
- **Subsystem:** Administrative Moderation
- **Short Description:**
  - Administrator bans a user from the platform. The `BannedUserGuard` on all write endpoints will subsequently block any write action attempted by the banned user.

- **Pre-conditions:**
  - Acting user has `role = ADMIN`
  - Target user exists and is not currently banned

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Admin clicks Ban/Unban | Calls admin ban/unban API | Pass | |
| 02 | System verifies admin | Guards verify ADMIN role | Pass | Verify ADMIN role |
| 03 | System updates database | Toggles `User.banned` status | Pass | |
| 04 | System returns success | Returns ok response; updates table | Pass | |
| 05 | System restricts user | `BannedUserGuard` blocks write requests | Pass | Revoke write access |
| 06 | Frontend alerts user | Displays suspension banner on reload | Pass | |

- **Post-condition:**
  - `User.banned = true` in the database
  - Banned user cannot perform any write actions (posts, likes, follows, messages, etc.)
  - Admin can unban at any time via `POST /api/admin/users/:id/unban`

---

### 5.11.2 &emsp; Test Case #: UC-65

- **Test Case Name:** Delete Reported Post (Admin)
- **System:** Breadit
- **Subsystem:** Administrative Moderation
- **Short Description:**
  - Administrator reviews the reports queue and permanently soft-deletes a reported post, simultaneously closing the report. Admins receive real-time REPORT notifications via Socket.IO when a new report is submitted.

- **Pre-conditions:**
  - Acting user has `role = ADMIN`
  - At least one OPEN report exists in the queue (`Report.status = "OPEN"`)
  - The reported post exists and has not been deleted

| Step | Action | System Response | Pass/Fail | Comments |
|:----:|--------|-----------------|:---------:|----------|
| 01 | Admin clicks Delete post on report | Calls delete reported post API | Pass | |
| 02 | System verifies admin role | Guards verify ADMIN role | Pass | Verify ADMIN role |
| 03 | System soft-deletes post | Sets `deletedAt = now()` in database | Pass | Soft-delete post |
| 04 | System closes report | Sets `Report.status = 'CLOSED'` in DB | Pass | |
| 05 | Frontend updates queue | Removes report card from list | Pass | |

- **Post-condition:**
  - Reported post is soft-deleted (`deletedAt` set) and hidden from all feeds
  - `Report.status = "CLOSED"`; report removed from the admin queue
