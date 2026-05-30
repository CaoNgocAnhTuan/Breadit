# Breadit — Use Case Catalogue

> All use cases reflect features **currently implemented** in the codebase (as of May 2026).

---

## Domain 1: Authentication & Onboarding

---

### 1. USE CASE UC-01:

Name: Register Account
Identifier UC-01

**Inputs:**
1. Username chosen by the user
2. Email address
3. Password (minimum 8 characters with at least one uppercase letter and one number)

**Output:**
1. New account created; user redirected to email verification page
2. Error message displayed if input validation fails (duplicate email/username → 409)

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to the registration page and fills in username, email, and password, then submits the form | |
| | 2.1. System validates all input fields (username format, email format, password strength) |
| | 2.2. System checks whether the email address and username are already registered |
| | 2.3. System hashes the password using bcrypt (10 salt rounds) and stores the new account with `emailVerified: null` |
| | 2.4. System generates a 6-digit verification code, stores it in `VerificationToken`, and sends it via SMTP email |
| | 2.5. System redirects the user to the `/verify` page |

**Precondition**
1. The user does not have an existing account with the provided email or username
2. SMTP is configured in the backend environment

**Post condition**
1. A new `User` record is created with `emailVerified = null`
2. A `VerificationToken` row is stored; a verification email is in the user's inbox

---

### 2. USE CASE UC-02:

Name: Verify Email Address
Identifier UC-02

**Inputs:**
1. Email address
2. 6-digit verification code received by email

**Output:**
1. Email verified; session cookie issued; user redirected to home feed
2. Error message if code is invalid or expired

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to `/verify` and enters the 6-digit code from their inbox | |
| | 2.1. System looks up the `VerificationToken` by `identifier: "email-verify:<email>"` and code |
| | 2.2. System validates the code has not expired (15-minute window) |
| | 2.3. System updates `User.emailVerified` to the current timestamp |
| | 2.4. System deletes all tokens for that email (one-time use) |
| | 2.5. System issues a `breadit_session` httpOnly JWT cookie and redirects to `/` |

**Precondition**
1. User is registered and `emailVerified` is null
2. A valid verification code was sent

**Post condition**
1. `User.emailVerified` is set to a timestamp
2. User can now create posts and interact with content

---

### 3. USE CASE UC-03:

Name: Resend Verification Code
Identifier UC-03

**Inputs:**
1. Email address

**Output:**
1. New 6-digit code sent to email (always returns 200 OK to prevent email enumeration)

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks "Resend verification code" on the `/verify` page | |
| | 2.1. System silently checks whether a user exists with that email and is unverified |
| | 2.2. If user does not exist or is already verified, system returns 200 OK without action |
| | 2.3. If user is unverified, system generates a new 6-digit code, overwrites the old token, and sends a new email |
| | 2.4. System returns 200 OK |

**Precondition**
1. User is registered but not yet verified

**Post condition**
1. New verification code is in user's inbox; previous code is invalidated

---

### 4. USE CASE UC-04:

Name: Log In
Identifier UC-04

**Inputs:**
1. Email address
2. Password

**Output:**
1. Session cookie set; user redirected to home feed
2. 401 error if credentials are invalid

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to `/sign-in`, fills in email and password, and submits | |
| | 2.1. System queries the user by email |
| | 2.2. System compares the provided password with the stored bcrypt hash |
| | 2.3. On mismatch, system returns 401 Unauthorized |
| | 2.4. On match, system generates a JWT with claims (userId, username, email, emailVerified, role, banned) |
| | 2.5. System sets an httpOnly `breadit_session` cookie with a 30-day expiry |
| | 2.6. System returns the user object; frontend redirects to `/` |

**Precondition**
1. User is registered with a password
2. Account is not banned (banned users may log in but are blocked from write actions)

**Post condition**
1. Session cookie is active; user can access protected routes

---

### 5. USE CASE UC-05:

Name: Log Out
Identifier UC-05

**Inputs:**
1. (none; action triggered by clicking Logout)

**Output:**
1. Session cookie cleared; user redirected to `/sign-in`

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the Logout button | |
| | 2.1. System calls `POST /api/auth/logout` |
| | 2.2. System clears the `breadit_session` cookie |
| | 2.3. Frontend clears session state and redirects to `/sign-in` |

**Precondition**
1. User is logged in

**Post condition**
1. Cookie cleared; all protected routes return 401 until next login

---

### 6. USE CASE UC-06:

Name: Request Password Reset
Identifier UC-06

**Inputs:**
1. Email address

**Output:**
1. Password reset link sent to email (always returns 200 OK)

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks "Forgot password" on the sign-in page and enters their email | |
| | 2.1. System silently checks whether the email exists |
| | 2.2. If not found, system returns 200 OK without action |
| | 2.3. If found, system generates a UUID reset token, stores it in `VerificationToken` with a 1-hour expiry |
| | 2.4. System sends an email with link `/reset?token=<uuid>` |
| | 2.5. System returns 200 OK |

**Precondition**
1. An account with the provided email exists

**Post condition**
1. Reset token stored in DB; reset link valid for 1 hour

---

### 7. USE CASE UC-07:

Name: Reset Password
Identifier UC-07

**Inputs:**
1. Reset token (from URL parameter)
2. New password

**Output:**
1. Password updated; user redirected to sign-in
2. Error if token is invalid or expired

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the reset link in email, navigates to `/reset?token=X`, enters a new password | |
| | 2.1. System looks up the `VerificationToken` by the UUID token value |
| | 2.2. System validates the token exists and has not expired (1-hour window) |
| | 2.3. System hashes the new password with bcrypt (10 rounds) |
| | 2.4. System updates `User.password` |
| | 2.5. System deletes the reset token (one-time use) |
| | 2.6. Frontend redirects to `/sign-in` |

**Precondition**
1. A valid, unexpired reset token exists in the database

**Post condition**
1. User can log in with the new password; old token is deleted

---

## Domain 2: Posts

---

### 8. USE CASE UC-08:

Name: Create Text Post
Identifier UC-08

**Inputs:**
1. Post description (up to 255 characters)
2. Optional: `isSensitive` flag (boolean)

**Output:**
1. Post created and displayed at the top of the user's feed
2. Mentioned users notified; hashtags indexed

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User types a post in the Share component and clicks "Post" | |
| | 2.1. System validates the description (≤ 255 characters) |
| | 2.2. `JwtAuthGuard` verifies the session; `EmailVerifiedGuard` confirms email is verified |
| | 2.3. System creates a `Post` record with `userId`, `desc`, `isSensitive`; `isApproved` defaults to true |
| | 2.4. System parses `#hashtags` → creates `Hashtag` + `PostTag` rows |
| | 2.5. System parses `@mentions` → fire-and-forget MENTION notifications to each mentioned user |
| | 2.6. System returns the complete post object; frontend invalidates the post cache |

**Precondition**
1. User is authenticated and email-verified
2. Description is ≤ 255 characters

**Post condition**
1. Post is visible in feeds; hashtags are searchable; mentioned users receive MENTION notifications

---

### 9. USE CASE UC-09:

Name: Create Post with Media (Image / Video)
Identifier UC-09

**Inputs:**
1. One or more image or video files (≤ 500 MB each, up to 10 files)
2. Optional description (≤ 255 characters)
3. Optional `imgType`: `"square"` | `"wide"` (default: unconstrained)

**Output:**
1. Post created with media attachments; images/videos rendered in feed

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User selects files in the Share component, optionally types a caption, and clicks "Post" | |
| | 2.1. System receives multipart request; validates file size and mimetype |
| | 2.2. For each file, `UploadsService.saveFile()` processes the file: uploads to Cloudinary with the requested crop transformation, or stores on local disk and resizes using `sharp` as a fallback |
| | 2.3. System creates `Post` record with `userId`, `desc` |
| | 2.4. System creates `PostMedia` rows (`url`, `type: "IMAGE"|"VIDEO"`) linked to the post |
| | 2.5. System returns the post with its `media` array; frontend renders the media grid |

**Precondition**
1. User is authenticated and email-verified
2. Each file is ≤ 500 MB; at most 10 files per request

**Post condition**
1. Media is accessible via Cloudinary URL or local `/uploads/` path; `PostMedia` records exist

---

### 10. USE CASE UC-10:

Name: Create Reply / Comment
Identifier UC-10

**Inputs:**
1. Parent post ID (from URL)
2. Reply description (≤ 255 characters)
3. Optional media files

**Output:**
1. Reply created and displayed in the comment thread under the parent post
2. Parent post owner receives a REPLY notification

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the reply button on a post, types a reply, and submits | |
| | 2.1. System creates a `Post` with `parentPostId` set to the parent; processes media the same as UC-09 |
| | 2.2. System queries the parent post's owner and emits a REPLY notification |
| | 2.3. System parses `@mentions` and sends MENTION notifications |
| | 2.4. System returns the reply post; frontend appends it to the comment thread |

**Precondition**
1. Parent post exists and is not deleted
2. User is authenticated and email-verified

**Post condition**
1. Reply is visible under the parent post; parent post owner notified

---

### 11. USE CASE UC-11:

Name: Create Plain Repost
Identifier UC-11

**Inputs:**
1. Original post ID

**Output:**
1. Repost created (or removed if already reposted); repost count updated; original owner notified

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the repost icon and selects "Repost" | |
| | 2.1. System checks for an existing plain repost (same `userId`, same `rePostId`, no `desc`) |
| | 2.2. If found: sets `deletedAt` to soft-delete the repost; returns `{ reposted: false, count }` |
| | 2.3. If not found: creates a `Post` with `rePostId`; emits a REPOST notification to the original owner |
| | 2.4. Frontend updates the repost button state and count |

**Precondition**
1. Original post exists; user is authenticated and email-verified

**Post condition**
1. Repost created or toggled off; original post owner notified

---

### 12. USE CASE UC-12:

Name: Create Quote-Repost
Identifier UC-12

**Inputs:**
1. Original post ID
2. Quote text (≤ 255 characters)
3. Optional media files

**Output:**
1. Quote-repost created as a new post embedding the original; original owner notified

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the repost icon, selects "Quote repost", types a caption in the modal, and submits | |
| | 2.1. System creates a `Post` with `rePostId` and non-null `desc`; processes optional media |
| | 2.2. System emits a REPOST notification to the original post's owner |
| | 2.3. System returns the new post; frontend renders the original post embedded inside it |

**Precondition**
1. Original post exists; user is authenticated and email-verified

**Post condition**
1. A new stand-alone post exists that references the original; original owner notified

---

### 13. USE CASE UC-13:

Name: Delete Own Post
Identifier UC-13

**Inputs:**
1. Post ID

**Output:**
1. Post soft-deleted and removed from all feeds

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks "Delete" in the post dropdown | |
| | 2.1. `JwtAuthGuard` and `BannedUserGuard` validate the user |
| | 2.2. System fetches the post and confirms `userId` matches the current user (returns 403 if not) |
| | 2.3. System sets `post.deletedAt = now()` (soft delete) |
| | 2.4. System returns `{ success: true }`; frontend removes the post from the cache |

**Precondition**
1. User owns the post
2. Post is not already deleted

**Post condition**
1. `Post.deletedAt` is set; post is hidden from all feeds

---

### USE CASE UC-71:

Name: Edit Own Post
Identifier UC-71

**Inputs:**
1. Post ID
2. Any combination of: updated `desc` (≤ 255 characters), new media files to add, `mediaIdsToRemove` (array of existing media IDs to delete)

**Output:**
1. Post updated in-place; feed reflects new content

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks "Edit" in the post dropdown, modifies the text or media, and saves | |
| | 2.1. `JwtAuthGuard`, `BannedUserGuard`, and `EmailVerifiedGuard` validate the user |
| | 2.2. System fetches the post and confirms `userId` matches the current user (returns 403 if not) |
| | 2.3. System processes any new media files (same upload pipeline as UC-09) |
| | 2.4. System removes media rows whose IDs are listed in `mediaIdsToRemove` |
| | 2.5. System updates `Post.desc` if provided |
| | 2.6. System returns the updated post; frontend invalidates the post cache |

**Precondition**
1. User owns the post; post is not deleted
2. User is authenticated, email-verified, and not banned

**Post condition**
1. Post content and/or media updated; changes visible in all feeds immediately

---

### 14. USE CASE UC-14:

Name: Report Post
Identifier UC-14

**Inputs:**
1. Post ID
2. Report reason (text)

**Output:**
1. Report created with status OPEN; all admin users notified in real-time

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the report icon on a post, selects a reason, and confirms | |
| | 2.1. `JwtAuthGuard` and `BannedUserGuard` validate the user |
| | 2.2. System creates a `Report` row (`reporterId`, `postId`, `reason`, `status: "OPEN"`) |
| | 2.3. System fetches all users with `role = ADMIN` |
| | 2.4. For each admin, system emits a REPORT notification via Socket.IO |
| | 2.5. System returns the report object |

**Precondition**
1. Post exists; user is not banned

**Post condition**
1. Report is in the admin queue; all admins receive a real-time notification

---

## Domain 3: Post Interactions

---

### 15. USE CASE UC-15:

Name: Like / Unlike Post
Identifier UC-15

**Inputs:**
1. Post ID

**Output:**
1. Like toggled; like count updated; post owner receives a LIKE notification on first like

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the heart icon on a post | |
| | 2.1. `JwtAuthGuard`, `BannedUserGuard`, and `EmailVerifiedGuard` validate the user |
| | 2.2. System checks for an existing `Like` row (`userId` + `postId`) |
| | 2.3. If found: deletes the row; returns `{ liked: false, count }` |
| | 2.4. If not found: creates the row; emits a LIKE notification to the post owner; returns `{ liked: true, count }` |
| | 2.5. Frontend updates the like button state and count |

**Precondition**
1. User is authenticated, email-verified, and not banned
2. Post exists

**Post condition**
1. Like state is toggled; post owner has a LIKE notification (on like action)

---

### 16. USE CASE UC-16:

Name: Bookmark / Save Post
Identifier UC-16

**Inputs:**
1. Post ID

**Output:**
1. Bookmark toggled; post added to or removed from the user's saved collection

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the bookmark icon on a post | |
| | 2.1. `JwtAuthGuard`, `BannedUserGuard`, and `EmailVerifiedGuard` validate the user |
| | 2.2. System checks for an existing `SavedPosts` row |
| | 2.3. If found: deletes the row; returns `{ saved: false }` |
| | 2.4. If not found: creates the row; returns `{ saved: true }` |
| | 2.5. Frontend updates the bookmark button state |

**Precondition**
1. User is authenticated, email-verified, and not banned; post exists

**Post condition**
1. `SavedPosts` row exists or is removed; post appears in or is removed from `/bookmarks`

---

### 17. USE CASE UC-17:

Name: View Bookmarked Posts
Identifier UC-17

**Inputs:**
1. Pagination cursor

**Output:**
1. Paginated list of the current user's saved posts

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to `/bookmarks` | |
| | 2.1. `JwtAuthGuard` validates the user |
| | 2.2. System queries `SavedPosts` where `userId` matches, joins `Post` (excludes deleted) |
| | 2.3. System paginates (limit 3) and returns `{ posts, hasMore }` |
| | 2.4. Frontend renders the list using infinite scroll |

**Precondition**
1. User is authenticated

**Post condition**
1. User can view and interact with their saved posts

---

## Domain 4: Social Graph

---

### 18. USE CASE UC-18:

Name: Follow / Unfollow User
Identifier UC-18

**Inputs:**
1. Target user ID
2. Optional: `notify` flag (boolean — notify on new posts)

**Output:**
1. Follow toggled; target user receives a FOLLOW notification on first follow

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User visits a profile and clicks the Follow button | |
| | 2.1. `JwtAuthGuard` and `BannedUserGuard` validate the user |
| | 2.2. System checks for an existing `Follow` row |
| | 2.3. If found: deletes the row; returns `{ following: false }` |
| | 2.4. If not found: creates the row (with `notify` flag); emits a FOLLOW notification; returns `{ following: true }` |
| | 2.5. The follower's home feed now includes the target's posts |

**Precondition**
1. Target user exists; follower and target are different users
2. User is not banned

**Post condition**
1. Follow relationship exists or is removed; target is notified of new followers

---

### 19. USE CASE UC-19:

Name: View Followers List
Identifier UC-19

**Inputs:**
1. Target username
2. Pagination cursor

**Output:**
1. Paginated list of users who follow the target

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the follower count on any profile, navigates to `/:username/followers` | |
| | 2.1. System queries `Follow` where `followingId = user.id` and joins follower user details |
| | 2.2. System orders by `createdAt` desc, paginates (limit 10), returns `{ users, hasMore }` |
| | 2.3. Frontend renders the list with infinite scroll |

**Precondition**
1. Target user exists

**Post condition**
1. User sees the list; can click profiles to navigate

---

### 20. USE CASE UC-20:

Name: View Following List
Identifier UC-20

**Inputs:**
1. Target username
2. Pagination cursor

**Output:**
1. Paginated list of users the target is following

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the following count on a profile, navigates to `/:username/following` | |
| | 2.1. System queries `Follow` where `followerId = user.id` and joins following user details |
| | 2.2. System paginates (limit 10) and returns `{ users, hasMore }` |
| | 2.3. Frontend renders the list |

**Precondition**
1. Target user exists

**Post condition**
1. User sees who the target is following; can navigate to their profiles

---

### 21. USE CASE UC-21:

Name: Block / Unblock User
Identifier UC-21

**Inputs:**
1. Target user ID

**Output:**
1. Block toggled; existing follow relationships removed on block; blocked user excluded from all feeds, search, and notifications

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User opens the "more" dropdown on a profile and selects "Block @username" | |
| | 2.1. `JwtAuthGuard` and `BannedUserGuard` validate the user |
| | 2.2. System checks for an existing `Block` row |
| | 2.3. If found: deletes the row (unblock); returns `{ blocked: false }` |
| | 2.4. If not found: creates the row; deletes all `Follow` rows between the two users in both directions; returns `{ blocked: true }` |
| | 2.5. All feeds, search results, and notification queries now filter out the blocked user |

**Precondition**
1. Both users are different
2. User is not banned

**Post condition**
1. Block exists or is removed; follow relationships deleted on block; blocked user filtered everywhere

---

### USE CASE UC-72:

Name: View Blocked Accounts
Identifier UC-72

**Inputs:**
1. (none; uses session)

**Output:**
1. List of users the current user has blocked

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to account settings or the blocked list page | |
| | 2.1. `JwtAuthGuard` and `BannedUserGuard` validate the user |
| | 2.2. System queries all `Block` rows where `blockerId = userId`; joins blocked user details |
| | 2.3. Returns the list of blocked users (id, username, displayName, avatar) |
| | 2.4. Frontend renders the blocked accounts list with Unblock buttons |

**Precondition**
1. User is authenticated and not banned

**Post condition**
1. User can review and unblock individual accounts from the list

---

## Domain 5: User Profile

---

### 22. USE CASE UC-22:

Name: View User Profile
Identifier UC-22

**Inputs:**
1. Username (URL parameter)

**Output:**
1. Full profile data including display name, bio, location, job, website, avatar, cover, follower/following counts, and block status

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks a username link anywhere (feed, mentions, search) and navigates to `/:username` | |
| | 2.1. System fetches the user by username (Server Component SSR) |
| | 2.2. System calculates `isBlocked` by checking the `Block` table in both directions |
| | 2.3. If blocked: returns limited view (no posts, no follow button) |
| | 2.4. If not blocked: returns full profile with follower/following counts, follow state, and action buttons |
| | 2.5. Frontend renders the profile header, FollowButton, UserActions dropdown, and ProfileTabs |

**Precondition**
1. Target user exists

**Post condition**
1. Viewer can follow, block, or browse the target's posts

---

### 23. USE CASE UC-23:

Name: Edit Own Profile
Identifier UC-23

**Inputs:**
1. Any combination of: `displayName`, `bio`, `location`, `job`, `website`, `img` (avatar URL), `cover` (cover URL)

**Output:**
1. Profile fields updated; session refreshed; profile page re-renders with new data

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks "Edit profile" on their own profile; the EditProfileModal opens with current values | |
| 2. User edits desired fields; optionally uploads new avatar or cover image | |
| | 3.1. For image changes, frontend calls `POST /api/uploads` (UC-37) to get URLs |
| | 3.2. Frontend calls `PATCH /api/users/me` with only the changed fields |
| | 3.3. `JwtAuthGuard` and `BannedUserGuard` validate the user |
| | 3.4. System sparse-updates the `User` record with the provided fields |
| | 3.5. System returns the updated user; frontend invalidates the session cache and calls `router.refresh()` |

**Precondition**
1. User is authenticated and not banned

**Post condition**
1. `User` record reflects the new values; profile page shows the updated data

---

### 24. USE CASE UC-24:

Name: View Profile Post Tabs
Identifier UC-24

**Inputs:**
1. Username
2. Tab: `"posts"` | `"replies"` | `"media"` | `"likes"`
3. Pagination cursor

**Output:**
1. Paginated posts filtered by the selected tab

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks a tab (Posts / Replies / Media / Likes) on any profile | |
| | 2.1. Frontend calls `GET /api/users/:username/posts?tab=<tab>&cursor=<n>` |
| | 2.2. System filters posts: **posts** → top-level; **replies** → `parentPostId != null`; **media** → has `PostMedia`; **likes** → user liked via `Like` table |
| | 2.3. All filters exclude deleted posts (`deletedAt = null`) |
| | 2.4. System paginates (limit 3) and returns `{ posts, hasMore }` |
| | 2.5. Frontend renders with infinite scroll |

**Precondition**
1. User exists; tab is valid

**Post condition**
1. User can view and interact with the filtered post set

---

### 25. USE CASE UC-25:

Name: Get User Recommendations
Identifier UC-25

**Inputs:**
1. Current user ID (from session)

**Output:**
1. Suggested users to follow

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to `/connect` or the Recommendations sidebar widget | |
| | 2.1. `JwtAuthGuard` validates the user |
| | 2.2. System returns suggested users (users not yet followed) |
| | 2.3. Frontend renders user cards with Follow buttons |

**Precondition**
1. User is authenticated

**Post condition**
1. User can follow recommendations to expand their social graph

---

## Domain 6: Feeds & Discovery

---

### 26. USE CASE UC-26:

Name: View Home Feed (For You)
Identifier UC-26

**Inputs:**
1. Pagination cursor
2. Optional: authenticated user session

**Output:**
1. Personalized paginated feed of posts from the user's follows (or a public feed for guests)

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User lands on `/` or clicks "For you" | |
| | 2.1. `OptionalJwtAuthGuard` allows authenticated and guest users |
| | 2.2. If authenticated: system fetches the user's followees; filters posts from self + followees; excludes replies, community posts, and posts by blocked users |
| | 2.3. System orders by `createdAt` desc, paginates (limit 3), returns `{ posts, hasMore }` |
| | 2.4. Frontend renders the infinite scroll feed |

**Precondition**
1. Posts exist in the system

**Post condition**
1. User sees a personalized (or public) feed and can interact with posts

---

### 27. USE CASE UC-27:

Name: View Explore Feed (Discover)
Identifier UC-27

**Inputs:**
1. Pagination cursor

**Output:**
1. Paginated feed of trending top-level posts ranked by a time-decay engagement score

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the "Explore" tab on the homepage (`/?feed=explore`) | |
| | 2.1. System filters: `parentPostId = null`, `communityId = null`, `deletedAt = null`; excludes blocked users; looks back at posts from the last 7 days (up to 400 candidates) |
| | 2.2. System scores each post using `computeExploreScoreFixed(likes, comments, reposts, ageHours)` — a time-decay formula that weights engagement against how old the post is |
| | 2.3. System applies author-diversity ranking via `applyExploreDiversity()` (max 3 posts per author per page) to prevent any single user from flooding the feed |
| | 2.4. System paginates the ranked list and returns `{ posts, hasMore, nextCursor }` |
| | 2.5. Frontend renders trending posts |

**Precondition**
1. Posts exist in the system

**Post condition**
1. User sees globally trending content ranked by engagement quality, not just raw like count

---

### 28. USE CASE UC-28:

Name: View Hashtag Feed
Identifier UC-28

**Inputs:**
1. Hashtag string (URL parameter)
2. Pagination cursor

**Output:**
1. Paginated feed of top-level posts tagged with the specified hashtag

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks a hashtag link or navigates to `/hashtag/:tag` | |
| | 2.1. System normalises the tag to lowercase |
| | 2.2. System queries `PostTag → Hashtag → Post` where tag matches; filters `deletedAt = null`, `parentPostId = null`, `communityId = null`; excludes blocked users |
| | 2.3. System orders by `createdAt` desc, paginates, returns `{ posts, hasMore }` |
| | 2.4. Frontend renders the hashtag feed |

**Precondition**
1. The hashtag exists (at least one post uses it)

**Post condition**
1. User can browse all posts with the hashtag and interact with them

---

### 29. USE CASE UC-29:

Name: View Community Feed
Identifier UC-29

**Inputs:**
1. Community ID
2. Pagination cursor

**Output:**
1. Paginated feed of approved top-level posts in the community

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to `/c/:slug` | |
| | 2.1. System filters: `communityId = :id`, `parentPostId = null`, `isApproved = true`, `deletedAt = null`; excludes blocked users |
| | 2.2. System paginates and returns `{ posts, hasMore }` |
| | 2.3. Frontend renders the community feed |

**Precondition**
1. Community exists

**Post condition**
1. User sees approved community posts and can interact

---

## Domain 7: Search

---

### 30. USE CASE UC-30:

Name: Global Search
Identifier UC-30

**Inputs:**
1. Search query string (`q`)

**Output:**
1. Multi-type results: matching posts, users, hashtags, and communities (up to 5 each)

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User types in the search bar and presses Enter; frontend navigates to `/search?q=<term>` | |
| | 2.1. `OptionalJwtAuthGuard` validates (guests allowed) |
| | 2.2. System runs four parallel ILIKE queries: posts (`desc`), users (`username`/`displayName`), hashtags (`tag`), communities (`name`/`slug`) |
| | 2.3. Each query applies block filtering (if authenticated) and excludes deleted/banned items |
| | 2.4. Returns `{ posts, users, hashtags, communities }` (limit 5 each) |
| | 2.5. Frontend renders results in sectioned lists; clicking navigates to post/profile/hashtag/community |

**Precondition**
1. Query string is non-empty

**Post condition**
1. User can navigate from search results to the relevant content

---

### 31. USE CASE UC-31:

Name: Live Search Dropdown
Identifier UC-31

**Inputs:**
1. Search query string (debounced 300 ms, minimum 1 character)

**Output:**
1. Inline dropdown showing top matching users, hashtags, and posts

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User begins typing in the search bar (≥ 1 character) | |
| | 2.1. Frontend debounces 300 ms, then calls `GET /api/search?q=<term>` |
| | 2.2. System returns results (same endpoint as UC-30) |
| | 2.3. Frontend renders a dropdown with sections: People (top 3), Hashtags (top 3), Posts (top 3) |
| | 2.4. User clicks a result → frontend navigates; dropdown closes |
| | 2.5. On blur or Escape, dropdown closes |

**Precondition**
1. Query is ≥ 1 character

**Post condition**
1. User navigates to the selected result or continues refining the query

---

## Domain 8: Notifications

---

### 32. USE CASE UC-32:

Name: Receive Like Notification
Identifier UC-32

**Inputs:**
1. Actor ID (who liked)
2. Recipient ID (post owner)
3. Post ID

**Output:**
1. `Notification` row created (type = LIKE); real-time Socket.IO push to recipient

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User A likes User B's post (UC-15) | |
| | 2.1. System checks `actorId ≠ recipientId` (no self-notifications) |
| | 2.2. System creates a `Notification` row (`type = LIKE`, `recipientId`, `actorId`, `postId`, `readAt = null`) |
| | 2.3. `NotificationsGateway` broadcasts `getNotification` event to User B's Socket.IO room |
| | 2.4. User B's frontend updates the notification badge count |

**Precondition**
1. Actor and recipient are different users; post exists

**Post condition**
1. LIKE notification persisted in DB; User B is notified in real-time

---

### 33. USE CASE UC-33:

Name: Receive Reply Notification
Identifier UC-33

**Inputs:**
1. Actor ID (who replied)
2. Recipient ID (parent post owner)
3. Parent post ID

**Output:**
1. REPLY notification created; real-time push to recipient

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User A replies to User B's post (UC-10) | |
| | 2.1. System queries the parent post's owner |
| | 2.2. System creates a `Notification` row (`type = REPLY`) and pushes to User B via Socket.IO |

**Precondition**
1. Parent post exists; users are different

**Post condition**
1. User B receives a REPLY notification and can navigate to the reply

---

### 34. USE CASE UC-34:

Name: Receive Repost Notification
Identifier UC-34

**Inputs:**
1. Actor ID (who reposted)
2. Recipient ID (original post owner)
3. Post ID

**Output:**
1. REPOST notification created; real-time push to recipient

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User A reposts User B's post (UC-11 or UC-12) | |
| | 2.1. System creates a `Notification` row (`type = REPOST`) and pushes to User B via Socket.IO |

**Precondition**
1. Post exists; users are different

**Post condition**
1. User B is aware of the repost in real-time

---

### 35. USE CASE UC-35:

Name: Receive Follow Notification
Identifier UC-35

**Inputs:**
1. Actor ID (who followed)
2. Recipient ID (who was followed)

**Output:**
1. FOLLOW notification created; real-time push to recipient

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User A follows User B (UC-18) | |
| | 2.1. System creates a `Notification` row (`type = FOLLOW`) and pushes to User B via Socket.IO |
| | 2.2. Notification links to User A's profile |

**Precondition**
1. Users are different

**Post condition**
1. User B knows who followed them; can navigate to User A's profile

---

### 36. USE CASE UC-36:

Name: Receive Mention Notification
Identifier UC-36

**Inputs:**
1. Actor ID (who posted)
2. Mentioned usernames (parsed from post description)
3. Post ID

**Output:**
1. MENTION notification(s) created; real-time push to each mentioned user

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User A creates a post containing `@username` mention(s) (UC-08) | |
| | 2.1. System parses `@[a-zA-Z0-9_]+` regex from the description |
| | 2.2. For each match, system queries the user by username |
| | 2.3. If found: creates a `Notification` row (`type = MENTION`) and pushes via Socket.IO; if not found: silently skips |

**Precondition**
1. Post contains valid `@username` mentions; mentioned users exist in the system

**Post condition**
1. Mentioned users receive MENTION notifications linking to the post

---

### 37. USE CASE UC-37:

Name: View Notification List
Identifier UC-37

**Inputs:**
1. Pagination cursor
2. Optional: `unread=true` filter

**Output:**
1. Paginated list of notifications with unread count

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the bell icon and navigates to `/notifications` | |
| | 2.1. `JwtAuthGuard` validates the user |
| | 2.2. System queries `Notification` where `recipientId = userId`; optionally filters `readAt = null` |
| | 2.3. System orders by `createdAt` desc, paginates (limit 10), joins actor and post |
| | 2.4. Returns `{ items, hasMore }` |
| | 2.5. Frontend renders each notification (avatar + action text + timestamp + unread indicator); clicking navigates to the related post or profile |

**Precondition**
1. User is authenticated

**Post condition**
1. User sees full notification history; can navigate to related content

---

### 38. USE CASE UC-38:

Name: Mark Notification as Read
Identifier UC-38

**Inputs:**
1. Notification ID

**Output:**
1. `Notification.readAt` timestamp set; unread count decremented

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks a notification row | |
| | 2.1. `JwtAuthGuard` validates; system checks `recipientId` matches the current user |
| | 2.2. System updates `Notification.readAt = now()` |
| | 2.3. System returns the notification; frontend navigates to the linked content |

**Precondition**
1. Notification exists and belongs to the current user

**Post condition**
1. Notification is marked read; unread badge count decremented

---

### 39. USE CASE UC-39:

Name: Mark All Notifications as Read
Identifier UC-39

**Inputs:**
1. (none; applies to all unread notifications for the current user)

**Output:**
1. All unread notifications marked read; bell badge cleared

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks "Mark all as read" on the notifications page | |
| | 2.1. `JwtAuthGuard` validates the user |
| | 2.2. System bulk-updates all `Notification` rows where `recipientId = userId` and `readAt = null` → `readAt = now()` |
| | 2.3. Frontend refetches the notification list; all items shown as read; badge disappears |

**Precondition**
1. User has at least one unread notification

**Post condition**
1. All notifications have `readAt` set; unread count = 0

---

## Domain 9: Direct Messaging

---

### 40. USE CASE UC-40:

Name: Start or Find a Conversation
Identifier UC-40

**Inputs:**
1. Target user ID

**Output:**
1. Existing or newly created 1:1 conversation returned; frontend navigates to the message thread

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the Message button on a profile or compose icon in the sidebar | |
| | 2.1. `JwtAuthGuard` and `EmailVerifiedGuard` validate the user |
| | 2.2. System checks `userId ≠ targetUserId` |
| | 2.3. System queries for an existing `Conversation` where both users are `ConversationMember`s |
| | 2.4. If found: returns the existing conversation with `otherMember`, `lastMessage`, `unreadCount` |
| | 2.5. If not found: creates `Conversation` + two `ConversationMember` rows; returns the new conversation |
| | 2.6. Frontend navigates to `/messages/:conversationId` |

**Precondition**
1. Both users exist and are different

**Post condition**
1. Conversation exists; user is in the thread and can send messages

---

### 41. USE CASE UC-41:

Name: View Conversations List
Identifier UC-41

**Inputs:**
1. Pagination cursor

**Output:**
1. Paginated list of conversations ordered by most recent message, with unread count per conversation

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to `/messages` | |
| | 2.1. `JwtAuthGuard` validates the user |
| | 2.2. System queries `Conversation` where user is a `ConversationMember`; orders by `updatedAt` desc; takes 20 |
| | 2.3. For each conversation: fetches `otherMember`, `lastMessage`, and counts unread messages (`createdAt > lastReadAt` and `senderId ≠ userId`) |
| | 2.4. Returns `{ items, nextCursor }` |
| | 2.5. Frontend renders: avatar, last message preview, unread badge, timestamp |

**Precondition**
1. User is authenticated

**Post condition**
1. User can select a conversation to view its thread

---

### 42. USE CASE UC-42:

Name: View Message Thread
Identifier UC-42

**Inputs:**
1. Conversation ID
2. Pagination cursor

**Output:**
1. Paginated messages in the conversation (oldest first); conversation marked as read

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks a conversation, navigates to `/messages/:conversationId` | |
| | 2.1. `JwtAuthGuard` validates; system checks user is a `ConversationMember` (403 if not) |
| | 2.2. System queries `Message` where `conversationId = :id`, orders by `createdAt` asc, takes 50, joins sender |
| | 2.3. Returns `{ messages, nextCursor }` |
| | 2.4. System calls `PATCH /api/conversations/:id/read` → updates `ConversationMember.lastReadAt = now()` |
| | 2.5. Frontend renders the thread (own messages right-aligned, others left-aligned); scrolls to bottom |

**Precondition**
1. User is a member of the conversation

**Post condition**
1. User sees the full message history; `lastReadAt` updated; unread count decremented

---

### 43. USE CASE UC-43:

Name: Send Text Message
Identifier UC-43

**Inputs:**
1. Conversation ID
2. Message body (≤ 1000 characters)

**Output:**
1. Message created; real-time delivery to recipient via Socket.IO

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User types a message and presses Enter or clicks Send | |
| | 2.1. Frontend optimistically appends the message to the local list |
| | 2.2. `JwtAuthGuard` and `EmailVerifiedGuard` validate; system checks user is a member (403 if not) |
| | 2.3. System creates a `Message` row (`conversationId`, `senderId`, `body`, `createdAt`) |
| | 2.4. System emits a `newMessage` Socket.IO event to the recipient's room |
| | 2.5. System updates `Conversation.updatedAt` (for list ordering) |
| | 2.6. System returns the created message; frontend replaces the optimistic item with the server-returned one |

**Precondition**
1. User is a member; body is ≤ 1000 characters

**Post condition**
1. Message is persisted; recipient receives it in real-time; conversation rises to the top of the list

---

### 44. USE CASE UC-44:

Name: Send Message with Media
Identifier UC-44

**Inputs:**
1. Conversation ID
2. Media URL (from a prior UC-45 upload)
3. Optional body text

**Output:**
1. Message with media URL created; rendered in the thread for both users

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User selects an image or video in the message input | |
| 2. Frontend calls `POST /api/uploads` (UC-45) to obtain the media URL | |
| | 3.1. Frontend calls `POST /api/conversations/:id/messages` with `{ body?, mediaUrl }` |
| | 3.2. System creates a `Message` row with `mediaUrl` set |
| | 3.3. System pushes `newMessage` event via Socket.IO |
| | 3.4. Both users see the media rendered inline in the thread |

**Precondition**
1. Media uploaded successfully; user is a member; file < 500 MB

**Post condition**
1. Media message visible in thread; recipient can click to expand

---

### 45. USE CASE UC-45:

Name: View Unread Message Count
Identifier UC-45

**Inputs:**
1. (none; uses session)

**Output:**
1. Total unread message count across all conversations

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Frontend calls `GET /api/conversations/unread-count` on mount | |
| | 2.1. `JwtAuthGuard` validates the user |
| | 2.2. System queries all conversations where user is a member; for each counts messages with `createdAt > lastReadAt` and `senderId ≠ userId` |
| | 2.3. Returns `{ count }` |
| | 2.4. Frontend shows the count as a badge on the messages icon in the sidebar |

**Precondition**
1. User is authenticated

**Post condition**
1. Sidebar badge reflects the correct unread count; updates as the user reads conversations

---

## Domain 10: Communities

---

### 46. USE CASE UC-46:

Name: Create Community
Identifier UC-46

**Inputs:**
1. Name
2. Slug (unique URL identifier)
3. Optional: description (≤ 255 characters), avatar image, cover image

**Output:**
1. Community created; creator automatically assigned OWNER role; frontend navigates to `/c/:slug`

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks "Create community", fills in name, slug, optional fields, and submits | |
| | 2.1. `JwtAuthGuard` and `EmailVerifiedGuard` validate the user |
| | 2.2. System checks slug uniqueness (409 if duplicate) |
| | 2.3. System creates a `Community` row and a `CommunityMember` row with `role = OWNER` |
| | 2.4. Returns the community object; frontend navigates to `/c/:slug` |

**Precondition**
1. User is authenticated and email-verified; slug not already taken

**Post condition**
1. Community exists; creator is OWNER and can post/manage immediately

---

### 47. USE CASE UC-47:

Name: Browse Communities
Identifier UC-47

**Inputs:**
1. Optional search query (`q`)

**Output:**
1. List of up to 20 communities with member count and membership state

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User navigates to `/communities` | |
| | 2.1. `OptionalJwtAuthGuard` allows guests |
| | 2.2. If authenticated: system fetches communities where user is banned and excludes them |
| | 2.3. If `q` provided: filters by `name`/`slug` ILIKE `q` |
| | 2.4. Returns first 20 communities with member count |
| | 2.5. Frontend renders community cards with Join/Joined/Banned state |

**Precondition**
1. Communities exist in the system

**Post condition**
1. User can join or navigate to a community

---

### 48. USE CASE UC-48:

Name: View Community Details
Identifier UC-48

**Inputs:**
1. Community slug (URL parameter)

**Output:**
1. Community metadata, rules, member list, post feed, and current user's membership state

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks a community card or navigates to `/c/:slug` | |
| | 2.1. `OptionalJwtAuthGuard` validates (guests allowed) |
| | 2.2. System fetches community by slug; includes rules, members with roles, post/member counts |
| | 2.3. If authenticated: computes `isMember`, `isBanned`, and the user's role |
| | 2.4. If banned: frontend shows "You are banned" and hides the feed |
| | 2.5. If OWNER/MOD: frontend shows moderation controls (PendingPostsBanner, admin dropdown) |

**Precondition**
1. Community exists

**Post condition**
1. User can join, view posts, or manage (if OWNER/MOD)

---

### 49. USE CASE UC-49:

Name: Join / Leave Community
Identifier UC-49

**Inputs:**
1. Community ID

**Output:**
1. Membership toggled (join or leave)

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User clicks the Join / Joined button on a community | |
| | 2.1. `JwtAuthGuard` and `BannedUserGuard` validate the user |
| | 2.2. System checks if user is community-banned (403 if banned) |
| | 2.3. If existing membership is OWNER: returns 403 (owners cannot leave) |
| | 2.4. If existing membership is MEMBER/MOD: deletes it; returns `{ joined: false }` |
| | 2.5. If no membership: creates with `role = MEMBER`; returns `{ joined: true }` |
| | 2.6. Frontend updates the button label and member count |

**Precondition**
1. Community exists; user is not community-banned; user is not the OWNER

**Post condition**
1. Membership created or removed; user can (or can no longer) post in the community

---

### 50. USE CASE UC-50:

Name: Post in Community
Identifier UC-50

**Inputs:**
1. Community ID
2. Post description (≤ 255 characters)
3. Optional media files

**Output:**
1. Post created with `communityId`; auto-approved for OWNER/MOD; pending approval for MEMBER

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Member navigates to `/c/:slug`, types in the Share box (which includes the community ID), and submits | |
| | 2.1. System checks membership and ban status (403 if banned) |
| | 2.2. If OWNER/MOD: creates post with `isApproved = true`; emits COMMUNITY_NEW_POST notification to all members |
| | 2.3. If MEMBER: creates post with `isApproved = false` (pending); emits COMMUNITY_POST notification to all OWNER/MOD |
| | 2.4. MEMBER's post does not appear in the feed until approved |

**Precondition**
1. User is a member of the community and not banned

**Post condition**
1. MEMBER posts are pending; OWNER/MOD posts are live; appropriate notifications sent

---

### 51. USE CASE UC-51:

Name: Approve / Reject Community Post
Identifier UC-51

**Inputs:**
1. Community ID
2. Post ID
3. Action: `"APPROVE"` | `"REMOVE"`

**Output:**
1. Post approved and published to the feed, or soft-deleted

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Moderator sees the PendingPostsBanner on the community page, clicks Approve or Reject on a pending post | |
| | 2.1. `JwtAuthGuard` validates; system checks user is OWNER or MOD (403 if not) |
| | 2.2. If APPROVE: sets `post.isApproved = true`; emits COMMUNITY_NEW_POST notification to all members except the poster |
| | 2.3. If REMOVE: sets `post.deletedAt = now()` |
| | 2.4. Frontend removes the post from the pending list; approved post appears in the feed |

**Precondition**
1. Post exists with `isApproved = false`; user is OWNER or MOD

**Post condition**
1. Post is live (approved) or archived (removed); members notified on approval

---

### 52. USE CASE UC-52:

Name: Add Community Rule
Identifier UC-52

**Inputs:**
1. Community ID
2. Rule title
3. Optional description (≤ 500 characters)

**Output:**
1. `CommunityRule` row created; displayed in community's about section

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Moderator navigates to `/c/:slug/about`, fills in the Add Rule form, and submits | |
| | 2.1. System checks user is OWNER or MOD (403 if not) |
| | 2.2. System creates a `CommunityRule` row |
| | 2.3. Frontend appends the new rule to the list |

**Precondition**
1. User is OWNER or MOD

**Post condition**
1. Rule is visible to all community visitors in the about section

---

### 53. USE CASE UC-53:

Name: Remove Community Rule
Identifier UC-53

**Inputs:**
1. Community ID
2. Rule ID

**Output:**
1. `CommunityRule` row deleted; rule removed from the about section

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Moderator clicks the delete icon on a rule in `/c/:slug/about` | |
| | 2.1. System checks user is OWNER or MOD |
| | 2.2. System deletes the `CommunityRule` row |
| | 2.3. Frontend removes the rule from the list |

**Precondition**
1. Rule exists; user is OWNER or MOD

**Post condition**
1. Rule no longer appears in the community's about section

---

### 54. USE CASE UC-54:

Name: Ban User from Community
Identifier UC-54

**Inputs:**
1. Community ID
2. Target user ID
3. Optional ban reason

**Output:**
1. `CommunityBannedUser` row created; target's membership removed; target cannot rejoin or view the feed

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Moderator clicks "Ban" on a member in the community members list | |
| | 2.1. System checks user is OWNER or MOD (403 if not) |
| | 2.2. System creates a `CommunityBannedUser` row with optional reason |
| | 2.3. System deletes the target's `CommunityMember` row |
| | 2.4. Frontend removes the member from the list |
| | 2.5. Target user's next visit to the community shows "You are banned" |

**Precondition**
1. Target is a member; acting user is OWNER or MOD

**Post condition**
1. Target is banned; cannot join, post, or view the community feed

---

### 55. USE CASE UC-55:

Name: Unban User from Community
Identifier UC-55

**Inputs:**
1. Community ID
2. Target user ID

**Output:**
1. `CommunityBannedUser` row deleted; target can rejoin the community

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Moderator clicks "Unban" on a banned user in `/c/:slug/about` | |
| | 2.1. System checks user is OWNER or MOD |
| | 2.2. System deletes the `CommunityBannedUser` row |
| | 2.3. Frontend removes the user from the banned list |

**Precondition**
1. User is banned; acting user is OWNER or MOD

**Post condition**
1. Ban lifted; target can rejoin the community

---

### 56. USE CASE UC-56:

Name: Promote Member to Moderator
Identifier UC-56

**Inputs:**
1. Community ID
2. Target user ID
3. New role: `"MOD"` | `"MEMBER"` (for demotion)

**Output:**
1. `CommunityMember.role` updated; member gains or loses moderation privileges

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Community owner clicks "Promote to MOD" on a member in the members list | |
| | 2.1. System checks user is OWNER (403 if not) |
| | 2.2. System updates `CommunityMember.role` to the specified value |
| | 2.3. Frontend updates the member's role badge |
| | 2.4. Promoted user can now approve posts, ban users, and manage rules |

**Precondition**
1. Target is a MEMBER; acting user is OWNER

**Post condition**
1. Target has MOD privileges; role badge updated

---

### 57. USE CASE UC-57:

Name: Transfer Community Ownership
Identifier UC-57

**Inputs:**
1. Community ID
2. New owner's user ID

**Output:**
1. Previous OWNER becomes MOD; new owner becomes OWNER

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Community owner selects "Transfer Ownership" and chooses a member | |
| | 2.1. System checks current user is OWNER |
| | 2.2. System updates: old owner's `CommunityMember.role → MOD`; new owner's `CommunityMember.role → OWNER` |
| | 2.3. Frontend updates role badges; previous owner loses owner-only controls |

**Precondition**
1. New owner is a current member; acting user is OWNER

**Post condition**
1. Ownership transferred; old owner becomes MOD

---

### 58. USE CASE UC-58:

Name: Delete Community
Identifier UC-58

**Inputs:**
1. Community ID

**Output:**
1. Community and all related data permanently deleted (posts soft-deleted)

**Basic Course**

| Actor: User | System |
|---|---|
| 1. Owner clicks "Delete Community" in `/c/:slug/about` and confirms the modal | |
| | 2.1. System checks user is OWNER |
| | 2.2. System atomically: soft-deletes all posts (`deletedAt = now()`), deletes all `CommunityBannedUser`, `CommunityRule`, `CommunityMember` rows, and deletes the `Community` row |
| | 2.3. Frontend navigates to `/communities` |

**Precondition**
1. User is OWNER

**Post condition**
1. Community no longer appears in listings; posts archived via soft delete

---

### 59. USE CASE UC-59:

Name: Update Community Details
Identifier UC-59

**Inputs:**
1. Community ID
2. Any combination of: `name`, `slug`, `description`, `img`, `cover`

**Output:**
1. Community fields updated; header re-renders with new data

**Basic Course**

| Actor: User | System |
|---|---|
| 1. OWNER/MOD clicks "Edit Community", modifies fields in the modal, and saves | |
| | 2.1. System checks user is OWNER or MOD |
| | 2.2. System sparse-updates the `Community` record |
| | 2.3. Frontend refreshes the community header |

**Precondition**
1. User is OWNER or MOD

**Post condition**
1. Community details reflect the changes

---

## Domain 11: Uploads

---

### 60. USE CASE UC-60:

Name: Upload Image or Video
Identifier UC-60

**Inputs:**
1. File (image or video, ≤ 500 MB)
2. Optional `imgType`: `"square"` | `"wide"` (default: unconstrained width ≤ 1200 px)

**Output:**
1. Processed media URL (Cloudinary HTTPS or local `/uploads/<filename>`) returned to the caller

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User selects a file (in Share component, Edit Profile modal, or message input) | |
| | 2.1. Frontend calls `POST /api/uploads` (multipart) |
| | 2.2. `JwtAuthGuard` and `EmailVerifiedGuard` validate the user |
| | 2.3. Backend parses the multipart file buffer and `imgType` field |
| | 2.4. If `CLOUDINARY_CLOUD_NAME` is set: uploads to Cloudinary with the appropriate crop transformation; returns `secure_url` |
| | 2.5. If Cloudinary is not configured: `sharp` re-encodes and resizes the image; saves to `UPLOAD_DIR`; returns a bare filename |
| | 2.6. Returns `{ filename }` to the frontend |

**Precondition**
1. User is authenticated and email-verified
2. File is a valid image or video; size ≤ 500 MB

**Post condition**
1. Media is stored and accessible via the returned URL; ready to be referenced in posts or profiles

---

## Domain 12: Admin Console

---

### 61. USE CASE UC-61:

Name: View Users List (Admin)
Identifier UC-61

**Inputs:**
1. Optional search query (`q`: username or email)
2. Pagination cursor

**Output:**
1. Paginated user table with ban controls

**Basic Course**

| Actor: Admin | System |
|---|---|
| 1. Admin navigates to `/admin-console/users` | |
| | 2.1. `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` validate the user |
| | 2.2. If `q` provided: filters `User` by `username`/`email` ILIKE `q` |
| | 2.3. Orders by `createdAt` desc; paginates (limit 20) |
| | 2.4. Returns `{ items, nextCursor }` |
| | 2.5. Frontend renders a table with username, email, role, banned status, and Ban/Unban buttons |

**Precondition**
1. User has `role = ADMIN`

**Post condition**
1. Admin can search, page through users, and take ban actions

---

### 62. USE CASE UC-62:

Name: Ban / Unban User (Admin)
Identifier UC-62

**Inputs:**
1. Target user ID
2. Action: ban or unban

**Output:**
1. `User.banned` field toggled; write access revoked or restored

**Basic Course**

| Actor: Admin | System |
|---|---|
| 1. Admin clicks "Ban" or "Unban" on a user row in the admin console | |
| | 2.1. `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` validate the user |
| | 2.2. System updates `User.banned = true` (ban) or `User.banned = false` (unban) |
| | 2.3. Returns `{ ok: true }` |
| | 2.4. Banned user: `BannedUserGuard` blocks all write endpoints (posts, likes, follows, etc.); frontend shows "Account suspended" banner on next load |
| | 2.5. Unbanned user: write access immediately restored |

**Precondition**
1. Acting user has `role = ADMIN`; target user exists

**Post condition**
1. Banned users cannot perform write actions; unbanned users regain full access

---

### 63. USE CASE UC-63:

Name: View Reports Queue
Identifier UC-63

**Inputs:**
1. Pagination cursor

**Output:**
1. Paginated list of OPEN reports with reporter info, reason, and post preview

**Basic Course**

| Actor: Admin | System |
|---|---|
| 1. Admin navigates to `/admin-console/reports` | |
| | 2.1. `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` validate the user |
| | 2.2. System queries `Report` where `status = 'OPEN'`; includes reporter user and post details |
| | 2.3. Orders by `createdAt` desc; paginates (limit 20) |
| | 2.4. Returns `{ items, nextCursor }` |
| | 2.5. Frontend renders: reporter, reason, post preview, Dismiss and Delete Post buttons |

**Precondition**
1. User has `role = ADMIN`; at least one OPEN report exists

**Post condition**
1. Admin can dismiss or delete each reported post

---

### 64. USE CASE UC-64:

Name: Dismiss Report
Identifier UC-64

**Inputs:**
1. Report ID

**Output:**
1. `Report.status` changed to CLOSED; post remains visible

**Basic Course**

| Actor: Admin | System |
|---|---|
| 1. Admin clicks "Dismiss" on a report | |
| | 2.1. `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` validate the user |
| | 2.2. System updates `Report.status = 'CLOSED'` |
| | 2.3. Frontend removes the report from the queue |

**Precondition**
1. Report is OPEN; acting user is ADMIN

**Post condition**
1. Report is closed; reported post is untouched

---

### 65. USE CASE UC-65:

Name: Delete Reported Post (Admin)
Identifier UC-65

**Inputs:**
1. Report ID

**Output:**
1. Reported post soft-deleted; report closed

**Basic Course**

| Actor: Admin | System |
|---|---|
| 1. Admin clicks "Delete post" on a report | |
| | 2.1. `JwtAuthGuard` + `RolesGuard` + `@Roles('ADMIN')` validate the user |
| | 2.2. System soft-deletes the post (`post.deletedAt = now()`) |
| | 2.3. System updates `Report.status = 'CLOSED'` |
| | 2.4. Frontend removes the report from the queue |

**Precondition**
1. Report is OPEN; post exists; acting user is ADMIN

**Post condition**
1. Post is hidden from all feeds; report is closed

---

## Domain 13: Guest / Public Access

---

### 66. USE CASE UC-66:

Name: View Public Feed (Guest)
Identifier UC-66

**Inputs:**
1. Pagination cursor

**Output:**
1. Paginated feed of top-level posts; interaction buttons prompt sign-in

**Basic Course**

| Actor: Guest | System |
|---|---|
| 1. Unauthenticated visitor opens the site at `/` | |
| | 2.1. `OptionalJwtAuthGuard` allows the request with `userId = undefined` |
| | 2.2. System filters: `parentPostId = null`, `communityId = null`, `deletedAt = null`; orders by `createdAt` desc |
| | 2.3. Returns paginated posts without interaction state (no liked/saved flags) |
| | 2.4. Frontend renders posts without like/repost/save buttons; a "Sign in to interact" CTA is displayed |

**Precondition**
1. Posts exist in the system

**Post condition**
1. Guest can read posts; clicking any interactive element redirects to `/sign-in`

---

### 67. USE CASE UC-67:

Name: View Post Permalink (Guest)
Identifier UC-67

**Inputs:**
1. Post ID (from URL `/:username/status/:postId`)

**Output:**
1. Post detail with comment thread; no interaction state; sign-in CTA shown

**Basic Course**

| Actor: Guest | System |
|---|---|
| 1. Guest opens a shared post link | |
| | 2.1. System fetches the post by ID (no auth required) and returns the post + comments thread |
| | 2.2. Frontend renders the post detail with replies |
| | 2.3. Interaction buttons show "Sign in to reply / like / repost" |

**Precondition**
1. Post exists and is not deleted

**Post condition**
1. Guest can read the post and replies; prompted to sign in to interact

---

### 68. USE CASE UC-68:

Name: View Public Profile (Guest)
Identifier UC-68

**Inputs:**
1. Username (URL parameter)

**Output:**
1. Profile header and post tabs without follow/interaction state

**Basic Course**

| Actor: Guest | System |
|---|---|
| 1. Guest navigates to `/:username` | |
| | 2.1. System fetches the user without auth (no block filtering); returns profile and posts without interaction state |
| | 2.2. Frontend renders the profile header and ProfileTabs |
| | 2.3. Follow button and interaction buttons prompt sign-in |

**Precondition**
1. User exists and is not banned

**Post condition**
1. Guest can read the profile and posts; prompted to sign in to follow

---

### 69. USE CASE UC-69:

Name: Search (Guest)
Identifier UC-69

**Inputs:**
1. Search query string (`q`)

**Output:**
1. Multi-type search results (posts, users, hashtags) without block filtering or interaction state

**Basic Course**

| Actor: Guest | System |
|---|---|
| 1. Guest types in the search bar, presses Enter | |
| | 2.1. `OptionalJwtAuthGuard` allows the request |
| | 2.2. System returns matching posts, users, and hashtags (no block filtering) |
| | 2.3. Frontend renders results; clicking navigates to post/profile/hashtag pages |
| | 2.4. Interaction buttons prompt sign-in |

**Precondition**
1. Query string is non-empty

**Post condition**
1. Guest can browse results; prompted to sign in to interact

---

### 70. USE CASE UC-70:

Name: Search Conversations
Identifier UC-70

**Inputs:**
1. Search query string (`q`)

**Output:**
1. List of conversations whose other member's username or display name matches the query

**Basic Course**

| Actor: User | System |
|---|---|
| 1. User types in the search input inside the `/messages` sidebar | |
| | 2.1. `JwtAuthGuard` validates the user |
| | 2.2. Frontend calls `GET /api/conversations/search?q=<term>` |
| | 2.3. System queries `Conversation` where user is a `ConversationMember`; filters by the other member's `username` or `displayName` ILIKE `q` |
| | 2.4. Returns matching conversations with `otherMember`, `lastMessage`, and `unreadCount` |
| | 2.5. Frontend renders the filtered conversation list in real-time |

**Precondition**
1. User is authenticated
2. Query string is at least 1 character

**Post condition**
1. User can navigate to the matching conversation from the search result

---

## Summary Table

| UC | Name | Domain |
|---|---|---|
| UC-01 | Register Account | Auth |
| UC-02 | Verify Email Address | Auth |
| UC-03 | Resend Verification Code | Auth |
| UC-04 | Log In | Auth |
| UC-05 | Log Out | Auth |
| UC-06 | Request Password Reset | Auth |
| UC-07 | Reset Password | Auth |
| UC-08 | Create Text Post | Posts |
| UC-09 | Create Post with Media | Posts |
| UC-10 | Create Reply / Comment | Posts |
| UC-11 | Create Plain Repost | Posts |
| UC-12 | Create Quote-Repost | Posts |
| UC-13 | Delete Own Post | Posts |
| UC-14 | Report Post | Posts |
| UC-15 | Like / Unlike Post | Interactions |
| UC-16 | Bookmark / Save Post | Interactions |
| UC-17 | View Bookmarked Posts | Interactions |
| UC-18 | Follow / Unfollow User | Social Graph |
| UC-19 | View Followers List | Social Graph |
| UC-20 | View Following List | Social Graph |
| UC-21 | Block / Unblock User | Social Graph |
| UC-22 | View User Profile | Profile |
| UC-23 | Edit Own Profile | Profile |
| UC-24 | View Profile Post Tabs | Profile |
| UC-25 | Get User Recommendations | Profile |
| UC-26 | View Home Feed (For You) | Feeds |
| UC-27 | View Explore Feed (Discover) | Feeds |
| UC-28 | View Hashtag Feed | Feeds |
| UC-29 | View Community Feed | Feeds |
| UC-30 | Global Search | Search |
| UC-31 | Live Search Dropdown | Search |
| UC-32 | Receive Like Notification | Notifications |
| UC-33 | Receive Reply Notification | Notifications |
| UC-34 | Receive Repost Notification | Notifications |
| UC-35 | Receive Follow Notification | Notifications |
| UC-36 | Receive Mention Notification | Notifications |
| UC-37 | View Notification List | Notifications |
| UC-38 | Mark Notification as Read | Notifications |
| UC-39 | Mark All Notifications as Read | Notifications |
| UC-40 | Start or Find a Conversation | Messaging |
| UC-41 | View Conversations List | Messaging |
| UC-42 | View Message Thread | Messaging |
| UC-43 | Send Text Message | Messaging |
| UC-44 | Send Message with Media | Messaging |
| UC-45 | View Unread Message Count | Messaging |
| UC-46 | Create Community | Communities |
| UC-47 | Browse Communities | Communities |
| UC-48 | View Community Details | Communities |
| UC-49 | Join / Leave Community | Communities |
| UC-50 | Post in Community | Communities |
| UC-51 | Approve / Reject Community Post | Communities |
| UC-52 | Add Community Rule | Communities |
| UC-53 | Remove Community Rule | Communities |
| UC-54 | Ban User from Community | Communities |
| UC-55 | Unban User from Community | Communities |
| UC-56 | Promote Member to Moderator | Communities |
| UC-57 | Transfer Community Ownership | Communities |
| UC-58 | Delete Community | Communities |
| UC-59 | Update Community Details | Communities |
| UC-60 | Upload Image or Video | Uploads |
| UC-61 | View Users List (Admin) | Admin |
| UC-62 | Ban / Unban User (Admin) | Admin |
| UC-63 | View Reports Queue | Admin |
| UC-64 | Dismiss Report | Admin |
| UC-65 | Delete Reported Post (Admin) | Admin |
| UC-66 | View Public Feed (Guest) | Guest Access |
| UC-67 | View Post Permalink (Guest) | Guest Access |
| UC-68 | View Public Profile (Guest) | Guest Access |
| UC-69 | Search (Guest) | Guest Access |
| UC-70 | Search Conversations | Messaging |
| UC-71 | Edit Own Post | Posts |
| UC-72 | View Blocked Accounts | Social Graph |
