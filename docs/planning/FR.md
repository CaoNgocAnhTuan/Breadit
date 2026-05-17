# Breadit — Functional Requirements

> Derived from `docs/usecase.md`. Each requirement is stated as **"The system shall…"** and is traceable to its source use case(s).

---

## Domain 1: Authentication & Onboarding

### UC-01 — Register Account

| ID | Functional Requirement |
|---|---|
| FR-001 | The system shall accept a username, email address, and password as inputs for account registration. |
| FR-002 | The system shall validate that the username is unique before creating a new account. |
| FR-003 | The system shall validate that the email address is unique and in a valid format before creating a new account. |
| FR-004 | The system shall reject registration with HTTP 409 if the email or username is already taken. |
| FR-005 | The system shall hash the user's password using bcrypt with 10 salt rounds before storing it. |
| FR-006 | The system shall create a new `User` record with `emailVerified = null` upon successful registration. |
| FR-007 | The system shall generate a random 6-digit numeric verification code upon registration. |
| FR-008 | The system shall store the verification code in `VerificationToken` with a 15-minute expiry window. |
| FR-009 | The system shall send the verification code to the user's registered email address via SMTP. |
| FR-010 | The system shall redirect the user to the `/verify` page after successful registration. |

---

### UC-02 — Verify Email Address

| ID | Functional Requirement |
|---|---|
| FR-011 | The system shall accept an email address and a 6-digit code as inputs for email verification. |
| FR-012 | The system shall look up the `VerificationToken` record using the email-prefixed identifier and the submitted code. |
| FR-013 | The system shall reject the verification attempt if the code does not match or if the token has expired. |
| FR-014 | The system shall set `User.emailVerified` to the current timestamp upon successful code validation. |
| FR-015 | The system shall delete all `VerificationToken` rows for the email after successful verification (one-time use). |
| FR-016 | The system shall issue a `breadit_session` httpOnly JWT cookie after email verification. |
| FR-017 | The system shall redirect the user to the home feed (`/`) after email verification. |

---

### UC-03 — Resend Verification Code

| ID | Functional Requirement |
|---|---|
| FR-018 | The system shall accept an email address and generate a new 6-digit verification code if the account is unverified. |
| FR-019 | The system shall overwrite any previously issued verification token for the same email when resending. |
| FR-020 | The system shall return HTTP 200 OK regardless of whether the email exists or is already verified, to prevent email enumeration. |

---

### UC-04 — Log In

| ID | Functional Requirement |
|---|---|
| FR-021 | The system shall accept an email address and password as login credentials. |
| FR-022 | The system shall look up the user by email and compare the submitted password against the stored bcrypt hash. |
| FR-023 | The system shall return HTTP 401 Unauthorized if the credentials do not match, without indicating which field is wrong. |
| FR-024 | The system shall generate a JWT containing the claims: `userId`, `username`, `email`, `emailVerified`, `role`, and `banned`. |
| FR-025 | The system shall set an httpOnly `breadit_session` cookie with a 30-day `maxAge` upon successful login. |
| FR-026 | The system shall return the authenticated user's profile data (id, username, email, img, role, banned) upon successful login. |

---

### UC-05 — Log Out

| ID | Functional Requirement |
|---|---|
| FR-027 | The system shall clear the `breadit_session` cookie when the user logs out. |
| FR-028 | The system shall redirect the user to `/sign-in` after the session cookie is cleared. |

---

### UC-06 — Request Password Reset

| ID | Functional Requirement |
|---|---|
| FR-029 | The system shall accept an email address and silently check whether an account exists. |
| FR-030 | The system shall generate a `crypto.randomUUID()` reset token and store it in `VerificationToken` with a 1-hour expiry if the account exists. |
| FR-031 | The system shall send an email containing a reset link in the format `/reset?token=<uuid>` to the registered address. |
| FR-032 | The system shall always return HTTP 200 OK regardless of whether the email exists, to prevent email enumeration. |

---

### UC-07 — Reset Password

| ID | Functional Requirement |
|---|---|
| FR-033 | The system shall accept a reset token (from the URL) and a new password as inputs. |
| FR-034 | The system shall look up the reset token in `VerificationToken` and reject the request if the token is invalid or expired. |
| FR-035 | The system shall hash the new password using bcrypt (10 rounds) and update `User.password`. |
| FR-036 | The system shall delete the reset token after a successful password change (one-time use). |
| FR-037 | The system shall redirect the user to `/sign-in` after a successful password reset. |

---

## Domain 2: Posts

### UC-08 — Create Text Post

| ID | Functional Requirement |
|---|---|
| FR-038 | The system shall require the user to be authenticated and email-verified before creating a post. |
| FR-039 | The system shall accept a post description of up to 255 characters. |
| FR-040 | The system shall accept an optional `isSensitive` boolean flag per post. |
| FR-041 | The system shall create a `Post` record with `userId`, `desc`, `isSensitive`; `isApproved` defaults to `true`. |
| FR-042 | The system shall parse `#hashtag` patterns from the post description, create `Hashtag` records if they do not exist, and create `PostTag` join records. |
| FR-043 | The system shall parse `@username` mentions from the post description and send a MENTION notification to each matched user (fire-and-forget; silently skips unresolved usernames). |
| FR-044 | The system shall return the complete post object including user, media, and interaction counts after creation. |

---

### UC-09 — Create Post with Media

| ID | Functional Requirement |
|---|---|
| FR-045 | The system shall accept up to 10 image or video files per post creation request. |
| FR-046 | The system shall reject any individual file exceeding 500 MB with an appropriate error. |
| FR-047 | The system shall accept an optional `imgType` parameter (`"square"` | `"wide"`) to control crop dimensions during upload. |
| FR-048 | The system shall upload each file to Cloudinary with the appropriate crop transformation when `CLOUDINARY_CLOUD_NAME` is configured. |
| FR-049 | The system shall resize and compress images locally using `sharp` and store them to disk when Cloudinary is not configured. |
| FR-050 | The system shall create a `PostMedia` record for each uploaded file containing `url` and `type` (`"IMAGE"` or `"VIDEO"`). |
| FR-051 | The system shall return the post with its full `media` array after creation. |

---

### UC-10 — Create Reply / Comment

| ID | Functional Requirement |
|---|---|
| FR-052 | The system shall accept a `parentPostId` to associate a new post as a reply to an existing post. |
| FR-053 | The system shall create the reply `Post` record with `parentPostId` set; media processing follows the same rules as UC-09. |
| FR-054 | The system shall query the parent post's owner and emit a REPLY notification to them after reply creation. |
| FR-055 | The system shall parse `@mention` patterns from reply descriptions and send MENTION notifications. |

---

### UC-11 — Create Plain Repost

| ID | Functional Requirement |
|---|---|
| FR-056 | The system shall check whether the authenticated user has already plain-reposted the target post (same `userId`, same `rePostId`, no `desc`). |
| FR-057 | If a plain repost exists, the system shall soft-delete it (set `deletedAt`) and return `{ reposted: false, count }`. |
| FR-058 | If no plain repost exists, the system shall create a new `Post` with `rePostId` set, emit a REPOST notification to the original post owner, and return `{ reposted: true, count }`. |

---

### UC-12 — Create Quote-Repost

| ID | Functional Requirement |
|---|---|
| FR-059 | The system shall create a new `Post` with both `rePostId` and a non-null `desc` to represent a quote-repost. |
| FR-060 | The system shall process optional media attachments on a quote-repost the same as UC-09. |
| FR-061 | The system shall emit a REPOST notification to the original post owner upon quote-repost creation. |

---

### UC-13 — Delete Own Post

| ID | Functional Requirement |
|---|---|
| FR-062 | The system shall verify that the authenticated user is the owner of the post before deletion (return HTTP 403 otherwise). |
| FR-063 | The system shall soft-delete the post by setting `post.deletedAt = now()` rather than issuing a hard delete. |
| FR-064 | The system shall exclude soft-deleted posts from all feed, search, and detail queries. |

---

### UC-14 — Report Post

| ID | Functional Requirement |
|---|---|
| FR-065 | The system shall accept a post ID and a reason string to create a report. |
| FR-066 | The system shall create a `Report` record with `reporterId`, `postId`, `reason`, and `status = "OPEN"`. |
| FR-067 | The system shall fetch all users with `role = ADMIN` and emit a REPORT notification to each via Socket.IO after a report is submitted. |

---

## Domain 3: Post Interactions

### UC-15 — Like / Unlike Post

| ID | Functional Requirement |
|---|---|
| FR-068 | The system shall require the user to be authenticated, email-verified, and not banned before liking a post. |
| FR-069 | The system shall toggle the like state: if a `Like` row exists it shall be deleted; if it does not exist it shall be created. |
| FR-070 | The system shall emit a LIKE notification to the post owner when a like is created (not on unlike). |
| FR-071 | The system shall return the updated like count and the new liked state (`{ liked, count }`) after toggling. |

---

### UC-16 — Bookmark / Save Post

| ID | Functional Requirement |
|---|---|
| FR-072 | The system shall toggle the bookmark state: if a `SavedPosts` row exists it shall be deleted; if it does not exist it shall be created. |
| FR-073 | The system shall return `{ saved: true }` or `{ saved: false }` to reflect the new bookmark state. |

---

### UC-17 — View Bookmarked Posts

| ID | Functional Requirement |
|---|---|
| FR-074 | The system shall return a paginated list (limit 3) of posts saved by the authenticated user, excluding deleted posts. |
| FR-075 | The system shall return a `hasMore` boolean to support infinite-scroll pagination on the bookmarks page. |

---

## Domain 4: Social Graph

### UC-18 — Follow / Unfollow User

| ID | Functional Requirement |
|---|---|
| FR-076 | The system shall prevent a user from following themselves. |
| FR-077 | The system shall toggle the follow state: if a `Follow` row exists it shall be deleted; if it does not exist it shall be created. |
| FR-078 | The system shall accept an optional `notify` flag to record whether the follower wants notifications for the target's new posts. |
| FR-079 | The system shall emit a FOLLOW notification to the target user when a follow is created. |
| FR-080 | The system shall include the followed user's posts in the follower's home feed after a follow is created. |

---

### UC-19 — View Followers List

| ID | Functional Requirement |
|---|---|
| FR-081 | The system shall return a paginated list (limit 10) of users who follow the specified target user, ordered by `createdAt` descending. |
| FR-082 | The system shall include follower profile details (id, username, displayName, img, bio) in the followers list response. |

---

### UC-20 — View Following List

| ID | Functional Requirement |
|---|---|
| FR-083 | The system shall return a paginated list (limit 10) of users that the specified target user is following, ordered by `createdAt` descending. |
| FR-084 | The system shall include following user profile details in the following list response. |

---

### UC-21 — Block / Unblock User

| ID | Functional Requirement |
|---|---|
| FR-085 | The system shall toggle the block state: if a `Block` row exists it shall be deleted (unblock); if not, it shall be created. |
| FR-086 | The system shall delete all `Follow` rows between the blocker and the blocked user in both directions when a block is created. |
| FR-087 | The system shall exclude blocked users' posts from all feed queries when the authenticated user's block list is available. |
| FR-088 | The system shall exclude blocked users from search results and notification queries. |

---

## Domain 5: User Profile

### UC-22 — View User Profile

| ID | Functional Requirement |
|---|---|
| FR-089 | The system shall return a user's full profile data (displayName, bio, location, job, website, img, cover, follower count, following count) by username. |
| FR-090 | The system shall compute and return `isBlocked` by checking the `Block` table in both directions when a viewer's `userId` is provided. |
| FR-091 | The system shall return a limited profile view (no posts, no follow button) when the viewer has blocked or been blocked by the target. |

---

### UC-23 — Edit Own Profile

| ID | Functional Requirement |
|---|---|
| FR-092 | The system shall accept any subset of: `displayName`, `bio`, `location`, `job`, `website`, `img`, `cover` for a profile update (sparse update). |
| FR-093 | The system shall apply only the provided fields to the `User` record, leaving unspecified fields unchanged. |
| FR-094 | The system shall return the full updated `User` record after a successful profile edit. |

---

### UC-24 — View Profile Post Tabs

| ID | Functional Requirement |
|---|---|
| FR-095 | The system shall support four profile tabs: `posts` (top-level, non-community), `replies` (`parentPostId != null`), `media` (has `PostMedia`), `likes` (liked via `Like` table). |
| FR-096 | The system shall exclude deleted posts (`deletedAt = null`) from all profile tab queries. |
| FR-097 | The system shall paginate profile tab results at a limit of 3 per page and return a `hasMore` flag. |

---

### UC-25 — Get User Recommendations

| ID | Functional Requirement |
|---|---|
| FR-098 | The system shall return a list of suggested users for the authenticated user to follow (users they do not already follow). |

---

## Domain 6: Feeds & Discovery

### UC-26 — View Home Feed (For You)

| ID | Functional Requirement |
|---|---|
| FR-099 | The system shall return a paginated feed of posts from the authenticated user's followees and the user themselves. |
| FR-100 | The system shall exclude replies (`parentPostId != null`), community posts (`communityId != null`), deleted posts, and posts from blocked users from the home feed. |
| FR-101 | The system shall return a public, non-personalised feed ordered by `createdAt` descending for unauthenticated guests. |
| FR-102 | The system shall order the home feed by `createdAt` descending and paginate at a limit of 3 per page. |

---

### UC-27 — View Explore Feed (Discover)

| ID | Functional Requirement |
|---|---|
| FR-103 | The system shall return a paginated feed of top-level, non-community posts ordered by like count descending, then `createdAt` descending. |
| FR-104 | The system shall exclude deleted posts and posts from blocked users from the explore feed. |

---

### UC-28 — View Hashtag Feed

| ID | Functional Requirement |
|---|---|
| FR-105 | The system shall normalise the hashtag string to lowercase before querying. |
| FR-106 | The system shall return a paginated feed of top-level, non-community, non-deleted posts associated with the specified hashtag. |
| FR-107 | The system shall exclude posts from blocked users from the hashtag feed when the viewer is authenticated. |

---

### UC-29 — View Community Feed

| ID | Functional Requirement |
|---|---|
| FR-108 | The system shall return a paginated feed of top-level, approved (`isApproved = true`), non-deleted posts belonging to the specified community. |
| FR-109 | The system shall exclude posts from blocked users from the community feed when the viewer is authenticated. |

---

## Domain 7: Search

### UC-30 — Global Search

| ID | Functional Requirement |
|---|---|
| FR-110 | The system shall perform case-insensitive (ILIKE) matching of the query string against post descriptions, usernames, display names, hashtag tags, and community names/slugs. |
| FR-111 | The system shall return up to 5 results per type: posts, users, hashtags, and communities. |
| FR-112 | The system shall apply block filtering to search results when the requesting user is authenticated. |
| FR-113 | The system shall exclude deleted posts and banned communities from search results. |
| FR-114 | The system shall allow unauthenticated (guest) users to perform searches without block filtering. |

---

### UC-31 — Live Search Dropdown

| ID | Functional Requirement |
|---|---|
| FR-115 | The system shall return live search results using the same endpoint as global search (UC-30). |
| FR-116 | The frontend shall debounce search input by 300 ms before sending a request to the server. |
| FR-117 | The frontend shall display a live dropdown with up to 3 results each for People, Hashtags, and Posts sections. |
| FR-118 | The frontend shall close the dropdown on input blur or when the user navigates to a result. |

---

## Domain 8: Notifications

### UC-32 — Receive Like Notification

| ID | Functional Requirement |
|---|---|
| FR-119 | The system shall create a `Notification` record with `type = LIKE`, `recipientId`, `actorId`, `postId`, and `readAt = null` when a post is liked. |
| FR-120 | The system shall not create a notification when a user likes their own post (`actorId = recipientId`). |
| FR-121 | The system shall broadcast a `getNotification` Socket.IO event to the recipient's room upon notification creation. |

---

### UC-33 — Receive Reply Notification

| ID | Functional Requirement |
|---|---|
| FR-122 | The system shall create a `Notification` record with `type = REPLY` and push it via Socket.IO to the parent post's owner when a reply is created. |
| FR-123 | The system shall not create a reply notification when a user replies to their own post. |

---

### UC-34 — Receive Repost Notification

| ID | Functional Requirement |
|---|---|
| FR-124 | The system shall create a `Notification` record with `type = REPOST` and push it via Socket.IO to the original post's owner when a repost (plain or quote) is created. |

---

### UC-35 — Receive Follow Notification

| ID | Functional Requirement |
|---|---|
| FR-125 | The system shall create a `Notification` record with `type = FOLLOW` and push it via Socket.IO to the followed user when a follow relationship is created. |

---

### UC-36 — Receive Mention Notification

| ID | Functional Requirement |
|---|---|
| FR-126 | The system shall parse `@[a-zA-Z0-9_]+` patterns from post and reply descriptions to identify mentioned usernames. |
| FR-127 | The system shall look up each mentioned username in the database and create a `Notification` record with `type = MENTION` for each matched user. |
| FR-128 | The system shall silently skip unresolved `@mention` targets without returning an error. |
| FR-129 | The system shall push MENTION notifications to mentioned users via Socket.IO in a fire-and-forget manner (does not block post creation). |

---

### UC-37 — View Notification List

| ID | Functional Requirement |
|---|---|
| FR-130 | The system shall return a paginated list (limit 10) of notifications for the authenticated user, ordered by `createdAt` descending. |
| FR-131 | The system shall support an optional `unread=true` query parameter to filter only notifications where `readAt = null`. |
| FR-132 | The system shall include the actor's profile details and the linked post (if applicable) in each notification record. |

---

### UC-38 — Mark Notification as Read

| ID | Functional Requirement |
|---|---|
| FR-133 | The system shall set `Notification.readAt = now()` for the specified notification after verifying the authenticated user is the recipient. |

---

### UC-39 — Mark All Notifications as Read

| ID | Functional Requirement |
|---|---|
| FR-134 | The system shall bulk-update all `Notification` rows where `recipientId` matches the authenticated user and `readAt = null`, setting `readAt = now()`. |

---

## Domain 9: Direct Messaging

### UC-40 — Start or Find a Conversation

| ID | Functional Requirement |
|---|---|
| FR-135 | The system shall require the user to be authenticated and email-verified before starting a conversation. |
| FR-136 | The system shall prevent a user from creating a conversation with themselves. |
| FR-137 | The system shall search for an existing `Conversation` where both users are `ConversationMember`s before creating a new one. |
| FR-138 | The system shall create a `Conversation` record and two `ConversationMember` records if no existing conversation is found. |
| FR-139 | The system shall return the conversation object with `otherMember`, `lastMessage`, and `unreadCount`. |

---

### UC-41 — View Conversations List

| ID | Functional Requirement |
|---|---|
| FR-140 | The system shall return a paginated list (limit 20) of conversations where the authenticated user is a member, ordered by `updatedAt` descending. |
| FR-141 | The system shall include `otherMember` profile, `lastMessage` content, and `unreadCount` for each conversation in the list. |
| FR-142 | The system shall compute `unreadCount` as the number of messages with `createdAt > lastReadAt` and `senderId ≠ userId`. |

---

### UC-42 — View Message Thread

| ID | Functional Requirement |
|---|---|
| FR-143 | The system shall return HTTP 403 if the authenticated user is not a member of the requested conversation. |
| FR-144 | The system shall return a paginated list (limit 50) of messages ordered by `createdAt` ascending (oldest first). |
| FR-145 | The system shall update `ConversationMember.lastReadAt = now()` when a user views a conversation thread. |

---

### UC-43 — Send Text Message

| ID | Functional Requirement |
|---|---|
| FR-146 | The system shall require the user to be authenticated and email-verified before sending a message. |
| FR-147 | The system shall enforce a maximum message body length of 1000 characters. |
| FR-148 | The system shall verify that the sender is a member of the conversation before persisting the message (return HTTP 403 otherwise). |
| FR-149 | The system shall create a `Message` record with `conversationId`, `senderId`, `body`, and `createdAt`. |
| FR-150 | The system shall emit a `newMessage` Socket.IO event to the recipient's conversation room after persisting the message. |
| FR-151 | The system shall update `Conversation.updatedAt` after each new message to maintain correct list ordering. |

---

### UC-44 — Send Message with Media

| ID | Functional Requirement |
|---|---|
| FR-152 | The system shall accept a `mediaUrl` field on message creation to attach a previously uploaded media file. |
| FR-153 | The system shall create a `Message` record with `mediaUrl` populated and push it via Socket.IO to the recipient. |

---

### UC-45 — View Unread Message Count

| ID | Functional Requirement |
|---|---|
| FR-154 | The system shall return the total count of unread messages across all conversations for the authenticated user. |
| FR-155 | The system shall compute unread count per conversation as messages with `createdAt > lastReadAt` and `senderId ≠ userId`, then sum across all conversations. |

---

## Domain 10: Communities

### UC-46 — Create Community

| ID | Functional Requirement |
|---|---|
| FR-156 | The system shall require the user to be authenticated and email-verified before creating a community. |
| FR-157 | The system shall validate that the community slug is unique and return HTTP 409 if it is already taken. |
| FR-158 | The system shall create a `Community` record and a `CommunityMember` record with `role = OWNER` for the creating user in the same operation. |

---

### UC-47 — Browse Communities

| ID | Functional Requirement |
|---|---|
| FR-159 | The system shall return up to 20 communities, optionally filtered by a case-insensitive query against `name` and `slug`. |
| FR-160 | The system shall exclude communities where the authenticated user is banned from the browse results. |
| FR-161 | The system shall include the member count for each community in the browse results. |

---

### UC-48 — View Community Details

| ID | Functional Requirement |
|---|---|
| FR-162 | The system shall return a community's metadata, rules, member list (with roles), post count, and member count by slug. |
| FR-163 | The system shall compute and return `isMember`, `isBanned`, and the user's `role` within the community when an authenticated user is the viewer. |
| FR-164 | The system shall allow guest (unauthenticated) access to community details. |

---

### UC-49 — Join / Leave Community

| ID | Functional Requirement |
|---|---|
| FR-165 | The system shall return HTTP 403 if the user is community-banned and attempts to join. |
| FR-166 | The system shall return HTTP 403 if the community OWNER attempts to leave. |
| FR-167 | The system shall delete the `CommunityMember` record if the user is an existing MEMBER or MOD (leave action). |
| FR-168 | The system shall create a `CommunityMember` record with `role = MEMBER` if the user is not already a member (join action). |

---

### UC-50 — Post in Community

| ID | Functional Requirement |
|---|---|
| FR-169 | The system shall return HTTP 403 if the user is not a member or is banned from the community. |
| FR-170 | The system shall create the post with `isApproved = true` and emit a COMMUNITY_NEW_POST notification to all members if the poster is OWNER or MOD. |
| FR-171 | The system shall create the post with `isApproved = false` (pending) and emit a COMMUNITY_POST notification to all OWNER/MOD members if the poster is a regular MEMBER. |
| FR-172 | The system shall exclude posts with `isApproved = false` from the community feed. |

---

### UC-51 — Approve / Reject Community Post

| ID | Functional Requirement |
|---|---|
| FR-173 | The system shall return HTTP 403 if the user attempting to moderate is not an OWNER or MOD of the community. |
| FR-174 | The system shall set `post.isApproved = true` and emit a COMMUNITY_NEW_POST notification to all members (except the poster) when the action is `"APPROVE"`. |
| FR-175 | The system shall soft-delete the post (`post.deletedAt = now()`) when the action is `"REMOVE"`. |

---

### UC-52 — Add Community Rule

| ID | Functional Requirement |
|---|---|
| FR-176 | The system shall create a `CommunityRule` record with `title` and optional `description` (≤ 500 characters) for the specified community. |
| FR-177 | The system shall return HTTP 403 if the user is not an OWNER or MOD of the community. |

---

### UC-53 — Remove Community Rule

| ID | Functional Requirement |
|---|---|
| FR-178 | The system shall delete the `CommunityRule` record for the specified rule ID and community ID. |
| FR-179 | The system shall return HTTP 403 if the user is not an OWNER or MOD of the community. |

---

### UC-54 — Ban User from Community

| ID | Functional Requirement |
|---|---|
| FR-180 | The system shall create a `CommunityBannedUser` record with an optional reason string. |
| FR-181 | The system shall delete the target's `CommunityMember` record when banning them from the community. |
| FR-182 | The system shall return HTTP 403 if the moderating user is not OWNER or MOD. |

---

### UC-55 — Unban User from Community

| ID | Functional Requirement |
|---|---|
| FR-183 | The system shall delete the `CommunityBannedUser` record for the specified user and community. |
| FR-184 | The system shall return HTTP 403 if the moderating user is not OWNER or MOD. |

---

### UC-56 — Promote Member to Moderator

| ID | Functional Requirement |
|---|---|
| FR-185 | The system shall update `CommunityMember.role` to the specified value (`"MOD"` or `"MEMBER"`) for the target user. |
| FR-186 | The system shall return HTTP 403 if the acting user is not the community OWNER. |

---

### UC-57 — Transfer Community Ownership

| ID | Functional Requirement |
|---|---|
| FR-187 | The system shall update the current OWNER's `CommunityMember.role` to `MOD` and the new owner's `CommunityMember.role` to `OWNER`. |
| FR-188 | The system shall return HTTP 403 if the acting user is not the current OWNER. |
| FR-189 | The system shall require the new owner to already be a member of the community. |

---

### UC-58 — Delete Community

| ID | Functional Requirement |
|---|---|
| FR-190 | The system shall execute the following operations atomically in a single database transaction: soft-delete all community posts, delete all `CommunityBannedUser` rows, delete all `CommunityRule` rows, delete all `CommunityMember` rows, and delete the `Community` row. |
| FR-191 | The system shall return HTTP 403 if the acting user is not the community OWNER. |

---

### UC-59 — Update Community Details

| ID | Functional Requirement |
|---|---|
| FR-192 | The system shall accept any subset of `name`, `slug`, `description`, `img`, `cover` and apply a sparse update to the `Community` record. |
| FR-193 | The system shall return HTTP 403 if the acting user is not an OWNER or MOD. |

---

## Domain 11: Uploads

### UC-60 — Upload Image or Video

| ID | Functional Requirement |
|---|---|
| FR-194 | The system shall require the user to be authenticated and email-verified before accepting a file upload. |
| FR-195 | The system shall reject files exceeding 500 MB. |
| FR-196 | The system shall upload images to Cloudinary with `quality: "auto"` and the appropriate crop transformation (`600×600` for square, `600×338` for wide, `1200px` width limit for default) when `CLOUDINARY_CLOUD_NAME` is configured. |
| FR-197 | The system shall use `sharp` to resize and JPEG-encode images (quality 80) and save them to `UPLOAD_DIR` when Cloudinary is not configured. |
| FR-198 | The system shall return the resulting media URL (`{ filename }`) to the caller for use in post or profile creation. |

---

## Domain 12: Admin Console

### UC-61 — View Users List (Admin)

| ID | Functional Requirement |
|---|---|
| FR-199 | The system shall restrict the users list endpoint to authenticated users with `role = ADMIN`. |
| FR-200 | The system shall support an optional case-insensitive query parameter `q` to filter users by `username` or `email`. |
| FR-201 | The system shall return a paginated list (limit 20) of users ordered by `createdAt` descending. |

---

### UC-62 — Ban / Unban User (Admin)

| ID | Functional Requirement |
|---|---|
| FR-202 | The system shall update `User.banned = true` when an admin bans a user. |
| FR-203 | The system shall update `User.banned = false` when an admin unbans a user. |
| FR-204 | The system shall prevent banned users from performing any write actions via `BannedUserGuard` (all guarded write endpoints return HTTP 403). |

---

### UC-63 — View Reports Queue

| ID | Functional Requirement |
|---|---|
| FR-205 | The system shall restrict the reports queue endpoint to authenticated users with `role = ADMIN`. |
| FR-206 | The system shall return a paginated list (limit 20) of `Report` records with `status = "OPEN"`, ordered by `createdAt` descending. |
| FR-207 | The system shall include reporter user details and post details (description, author) in each report record. |

---

### UC-64 — Dismiss Report

| ID | Functional Requirement |
|---|---|
| FR-208 | The system shall update `Report.status = "CLOSED"` when an admin dismisses a report. |
| FR-209 | The system shall leave the reported post unchanged when a report is dismissed. |

---

### UC-65 — Delete Reported Post (Admin)

| ID | Functional Requirement |
|---|---|
| FR-210 | The system shall soft-delete the reported post (`post.deletedAt = now()`) when an admin takes the delete action. |
| FR-211 | The system shall update `Report.status = "CLOSED"` after the post is soft-deleted. |

---

## Domain 13: Guest / Public Access

### UC-66 — View Public Feed (Guest)

| ID | Functional Requirement |
|---|---|
| FR-212 | The system shall return a paginated feed of top-level, non-community, non-deleted posts without requiring authentication. |
| FR-213 | The system shall not include interaction state (liked, saved, reposted) in responses to unauthenticated requests. |

---

### UC-67 — View Post Permalink (Guest)

| ID | Functional Requirement |
|---|---|
| FR-214 | The system shall return a post's detail data and its comments thread without requiring authentication. |
| FR-215 | The system shall not include interaction state in post detail responses to unauthenticated requests. |

---

### UC-68 — View Public Profile (Guest)

| ID | Functional Requirement |
|---|---|
| FR-216 | The system shall return a user's public profile data and their posts without requiring authentication. |
| FR-217 | The system shall not apply block filtering when the viewer is unauthenticated. |

---

### UC-69 — Search (Guest)

| ID | Functional Requirement |
|---|---|
| FR-218 | The system shall return search results for posts, users, and hashtags without requiring authentication. |
| FR-219 | The system shall not apply block filtering to search results when the viewer is unauthenticated. |

---

## Complete Functional Requirements Index

| ID | Requirement Summary | UC |
|---|---|---|
| FR-001 | Accept username, email, password for registration | UC-01 |
| FR-002 | Validate username uniqueness | UC-01 |
| FR-003 | Validate email uniqueness and format | UC-01 |
| FR-004 | Reject duplicate registration with HTTP 409 | UC-01 |
| FR-005 | Hash password with bcrypt (10 rounds) | UC-01 |
| FR-006 | Create `User` with `emailVerified = null` | UC-01 |
| FR-007 | Generate 6-digit verification code | UC-01 |
| FR-008 | Store verification code with 15-minute expiry | UC-01 |
| FR-009 | Send verification code by SMTP email | UC-01 |
| FR-010 | Redirect to `/verify` after registration | UC-01 |
| FR-011 | Accept email + code for verification | UC-02 |
| FR-012 | Look up token by email-prefixed identifier + code | UC-02 |
| FR-013 | Reject invalid or expired verification codes | UC-02 |
| FR-014 | Set `User.emailVerified` on success | UC-02 |
| FR-015 | Delete verification tokens after use | UC-02 |
| FR-016 | Issue `breadit_session` cookie after verification | UC-02 |
| FR-017 | Redirect to home feed after verification | UC-02 |
| FR-018 | Generate new code on resend if account is unverified | UC-03 |
| FR-019 | Overwrite previous token on resend | UC-03 |
| FR-020 | Always return 200 OK on resend (no enumeration) | UC-03 |
| FR-021 | Accept email + password for login | UC-04 |
| FR-022 | Compare password with bcrypt hash | UC-04 |
| FR-023 | Return HTTP 401 on credential mismatch | UC-04 |
| FR-024 | Generate JWT with user claims | UC-04 |
| FR-025 | Set httpOnly cookie with 30-day expiry | UC-04 |
| FR-026 | Return user profile data on login | UC-04 |
| FR-027 | Clear session cookie on logout | UC-05 |
| FR-028 | Redirect to `/sign-in` after logout | UC-05 |
| FR-029 | Silently check email on password reset request | UC-06 |
| FR-030 | Generate UUID reset token with 1-hour expiry | UC-06 |
| FR-031 | Send reset link email | UC-06 |
| FR-032 | Always return 200 OK on reset request (no enumeration) | UC-06 |
| FR-033 | Accept token + new password for reset | UC-07 |
| FR-034 | Reject invalid or expired reset tokens | UC-07 |
| FR-035 | Hash new password and update `User.password` | UC-07 |
| FR-036 | Delete reset token after use | UC-07 |
| FR-037 | Redirect to `/sign-in` after password reset | UC-07 |
| FR-038 | Require auth + email verification for post creation | UC-08 |
| FR-039 | Enforce 255-character limit on post descriptions | UC-08 |
| FR-040 | Accept `isSensitive` flag on posts | UC-08 |
| FR-041 | Create `Post` record with default `isApproved = true` | UC-08 |
| FR-042 | Parse hashtags and create `Hashtag` + `PostTag` records | UC-08 |
| FR-043 | Parse `@mentions` and send fire-and-forget MENTION notifications | UC-08 |
| FR-044 | Return complete post object after creation | UC-08 |
| FR-045 | Accept up to 10 files per post | UC-09 |
| FR-046 | Reject files exceeding 500 MB | UC-09 |
| FR-047 | Accept `imgType` parameter for crop dimensions | UC-09 |
| FR-048 | Upload to Cloudinary with crop transformation when configured | UC-09 |
| FR-049 | Resize and compress images locally using `sharp` as fallback | UC-09 |
| FR-050 | Create `PostMedia` record per uploaded file | UC-09 |
| FR-051 | Return post with `media` array | UC-09 |
| FR-052 | Accept `parentPostId` for reply creation | UC-10 |
| FR-053 | Create reply with `parentPostId`; process media same as UC-09 | UC-10 |
| FR-054 | Emit REPLY notification to parent post owner | UC-10 |
| FR-055 | Parse `@mentions` in replies and send MENTION notifications | UC-10 |
| FR-056 | Check for existing plain repost before creating | UC-11 |
| FR-057 | Soft-delete existing plain repost on toggle | UC-11 |
| FR-058 | Create plain repost and emit REPOST notification | UC-11 |
| FR-059 | Create quote-repost with `rePostId` and non-null `desc` | UC-12 |
| FR-060 | Process media on quote-repost same as UC-09 | UC-12 |
| FR-061 | Emit REPOST notification on quote-repost | UC-12 |
| FR-062 | Verify post ownership before deletion (HTTP 403 if not owner) | UC-13 |
| FR-063 | Soft-delete posts via `deletedAt` timestamp | UC-13 |
| FR-064 | Exclude soft-deleted posts from all queries | UC-13 |
| FR-065 | Accept post ID + reason for report creation | UC-14 |
| FR-066 | Create `Report` with `status = "OPEN"` | UC-14 |
| FR-067 | Emit REPORT notification to all ADMINs via Socket.IO | UC-14 |
| FR-068 | Require auth + email-verified + not-banned for likes | UC-15 |
| FR-069 | Toggle `Like` row (create or delete) | UC-15 |
| FR-070 | Emit LIKE notification to post owner on like creation | UC-15 |
| FR-071 | Return `{ liked, count }` after toggle | UC-15 |
| FR-072 | Toggle `SavedPosts` row (create or delete) | UC-16 |
| FR-073 | Return `{ saved }` state after bookmark toggle | UC-16 |
| FR-074 | Return paginated saved posts (limit 3), excluding deleted | UC-17 |
| FR-075 | Return `hasMore` flag for bookmark pagination | UC-17 |
| FR-076 | Prevent self-follow | UC-18 |
| FR-077 | Toggle `Follow` row (create or delete) | UC-18 |
| FR-078 | Accept `notify` flag on follow creation | UC-18 |
| FR-079 | Emit FOLLOW notification on follow creation | UC-18 |
| FR-080 | Include followed user's posts in follower's home feed | UC-18 |
| FR-081 | Return paginated followers list (limit 10) | UC-19 |
| FR-082 | Include follower profile details in response | UC-19 |
| FR-083 | Return paginated following list (limit 10) | UC-20 |
| FR-084 | Include following user profile details in response | UC-20 |
| FR-085 | Toggle `Block` row (create or delete) | UC-21 |
| FR-086 | Delete `Follow` rows in both directions on block creation | UC-21 |
| FR-087 | Exclude blocked users' posts from all feed queries | UC-21 |
| FR-088 | Exclude blocked users from search and notification queries | UC-21 |
| FR-089 | Return full user profile by username | UC-22 |
| FR-090 | Compute and return `isBlocked` in both directions | UC-22 |
| FR-091 | Return limited profile view when blocked | UC-22 |
| FR-092 | Accept sparse profile update fields | UC-23 |
| FR-093 | Apply only provided fields to `User` record | UC-23 |
| FR-094 | Return updated `User` record after edit | UC-23 |
| FR-095 | Support four profile tabs: posts, replies, media, likes | UC-24 |
| FR-096 | Exclude deleted posts from profile tab queries | UC-24 |
| FR-097 | Paginate profile tabs (limit 3) with `hasMore` | UC-24 |
| FR-098 | Return suggested users not already followed | UC-25 |
| FR-099 | Return personalized feed from followees + self | UC-26 |
| FR-100 | Exclude replies, community posts, deleted, and blocked from home feed | UC-26 |
| FR-101 | Return public non-personalised feed for guests | UC-26 |
| FR-102 | Order home feed by `createdAt` desc, limit 3 per page | UC-26 |
| FR-103 | Order explore feed by likes DESC then `createdAt` DESC | UC-27 |
| FR-104 | Exclude deleted and blocked from explore feed | UC-27 |
| FR-105 | Normalise hashtag to lowercase before query | UC-28 |
| FR-106 | Return paginated top-level non-community posts for hashtag | UC-28 |
| FR-107 | Exclude blocked users from hashtag feed | UC-28 |
| FR-108 | Return paginated approved top-level community posts | UC-29 |
| FR-109 | Exclude blocked users from community feed | UC-29 |
| FR-110 | Perform case-insensitive search across posts, users, hashtags, communities | UC-30 |
| FR-111 | Limit search results to 5 per type | UC-30 |
| FR-112 | Apply block filtering to authenticated search | UC-30 |
| FR-113 | Exclude deleted posts and banned communities from search | UC-30 |
| FR-114 | Allow guest search without authentication | UC-30 |
| FR-115 | Use same search endpoint for live dropdown | UC-31 |
| FR-116 | Debounce live search input by 300 ms | UC-31 |
| FR-117 | Display live dropdown with ≤ 3 results per section | UC-31 |
| FR-118 | Close dropdown on blur or navigation | UC-31 |
| FR-119 | Create LIKE notification record with `readAt = null` | UC-32 |
| FR-120 | Skip LIKE notification when actor = recipient | UC-32 |
| FR-121 | Broadcast `getNotification` Socket.IO event to recipient | UC-32 |
| FR-122 | Create REPLY notification and push via Socket.IO | UC-33 |
| FR-123 | Skip REPLY notification for self-replies | UC-33 |
| FR-124 | Create REPOST notification and push via Socket.IO | UC-34 |
| FR-125 | Create FOLLOW notification and push via Socket.IO | UC-35 |
| FR-126 | Parse `@username` patterns from post descriptions | UC-36 |
| FR-127 | Create MENTION notification per matched user | UC-36 |
| FR-128 | Silently skip unresolved `@mention` targets | UC-36 |
| FR-129 | Push MENTION notifications as fire-and-forget | UC-36 |
| FR-130 | Return paginated notifications (limit 10), ordered by `createdAt` desc | UC-37 |
| FR-131 | Support `unread=true` filter for unread notifications | UC-37 |
| FR-132 | Include actor and linked post in notification response | UC-37 |
| FR-133 | Set `Notification.readAt = now()` on mark-as-read | UC-38 |
| FR-134 | Bulk-update all unread notifications for user to `readAt = now()` | UC-39 |
| FR-135 | Require auth + email-verified for starting conversations | UC-40 |
| FR-136 | Prevent self-conversation creation | UC-40 |
| FR-137 | Find existing conversation before creating a new one | UC-40 |
| FR-138 | Create `Conversation` + two `ConversationMember` rows if none found | UC-40 |
| FR-139 | Return conversation with `otherMember`, `lastMessage`, `unreadCount` | UC-40 |
| FR-140 | Return paginated conversation list (limit 20) by `updatedAt` desc | UC-41 |
| FR-141 | Include `otherMember`, `lastMessage`, and `unreadCount` per conversation | UC-41 |
| FR-142 | Compute `unreadCount` from `lastReadAt` and `senderId` | UC-41 |
| FR-143 | Return HTTP 403 if user is not a conversation member | UC-42 |
| FR-144 | Return paginated messages (limit 50) by `createdAt` asc | UC-42 |
| FR-145 | Update `ConversationMember.lastReadAt` on thread view | UC-42 |
| FR-146 | Require auth + email-verified for sending messages | UC-43 |
| FR-147 | Enforce 1000-character message body limit | UC-43 |
| FR-148 | Verify sender is a conversation member before persisting | UC-43 |
| FR-149 | Create `Message` record with required fields | UC-43 |
| FR-150 | Emit `newMessage` Socket.IO event to recipient's room | UC-43 |
| FR-151 | Update `Conversation.updatedAt` after each new message | UC-43 |
| FR-152 | Accept `mediaUrl` field on message creation | UC-44 |
| FR-153 | Create `Message` with `mediaUrl` and push via Socket.IO | UC-44 |
| FR-154 | Return total unread message count for authenticated user | UC-45 |
| FR-155 | Compute unread count from `lastReadAt` across all conversations | UC-45 |
| FR-156 | Require auth + email-verified for community creation | UC-46 |
| FR-157 | Validate slug uniqueness (HTTP 409 on duplicate) | UC-46 |
| FR-158 | Create `Community` + `CommunityMember` (OWNER) in one operation | UC-46 |
| FR-159 | Return up to 20 communities with optional name/slug filter | UC-47 |
| FR-160 | Exclude communities where user is banned | UC-47 |
| FR-161 | Include member count per community in browse results | UC-47 |
| FR-162 | Return community metadata, rules, member list by slug | UC-48 |
| FR-163 | Compute `isMember`, `isBanned`, and user `role` for authenticated viewers | UC-48 |
| FR-164 | Allow guest access to community details | UC-48 |
| FR-165 | Return HTTP 403 on join if user is community-banned | UC-49 |
| FR-166 | Return HTTP 403 if OWNER attempts to leave | UC-49 |
| FR-167 | Delete `CommunityMember` on leave (MEMBER/MOD) | UC-49 |
| FR-168 | Create `CommunityMember` with `role = MEMBER` on join | UC-49 |
| FR-169 | Return HTTP 403 for non-members or banned users posting | UC-50 |
| FR-170 | Auto-approve OWNER/MOD posts and emit COMMUNITY_NEW_POST | UC-50 |
| FR-171 | Set MEMBER posts to pending and emit COMMUNITY_POST to moderators | UC-50 |
| FR-172 | Exclude `isApproved = false` posts from community feed | UC-50 |
| FR-173 | Return HTTP 403 if moderator is not OWNER or MOD | UC-51 |
| FR-174 | Set `isApproved = true` and emit COMMUNITY_NEW_POST on APPROVE | UC-51 |
| FR-175 | Soft-delete post on REMOVE action | UC-51 |
| FR-176 | Create `CommunityRule` with title and optional description | UC-52 |
| FR-177 | Return HTTP 403 if not OWNER or MOD (add rule) | UC-52 |
| FR-178 | Delete `CommunityRule` by ID | UC-53 |
| FR-179 | Return HTTP 403 if not OWNER or MOD (remove rule) | UC-53 |
| FR-180 | Create `CommunityBannedUser` with optional reason | UC-54 |
| FR-181 | Delete target's `CommunityMember` on ban | UC-54 |
| FR-182 | Return HTTP 403 if not OWNER or MOD (ban user) | UC-54 |
| FR-183 | Delete `CommunityBannedUser` on unban | UC-55 |
| FR-184 | Return HTTP 403 if not OWNER or MOD (unban user) | UC-55 |
| FR-185 | Update `CommunityMember.role` to `MOD` or `MEMBER` | UC-56 |
| FR-186 | Return HTTP 403 if not OWNER (promote) | UC-56 |
| FR-187 | Swap OWNER → MOD and target → OWNER on transfer | UC-57 |
| FR-188 | Return HTTP 403 if not current OWNER (transfer) | UC-57 |
| FR-189 | Require new owner to be an existing member | UC-57 |
| FR-190 | Delete community and all related data atomically | UC-58 |
| FR-191 | Return HTTP 403 if not OWNER (delete community) | UC-58 |
| FR-192 | Apply sparse update to `Community` record | UC-59 |
| FR-193 | Return HTTP 403 if not OWNER or MOD (update community) | UC-59 |
| FR-194 | Require auth + email-verified for file uploads | UC-60 |
| FR-195 | Reject files exceeding 500 MB | UC-60 |
| FR-196 | Upload to Cloudinary with crop transformation when configured | UC-60 |
| FR-197 | Resize and JPEG-encode images locally using `sharp` as fallback | UC-60 |
| FR-198 | Return media URL `{ filename }` to caller | UC-60 |
| FR-199 | Restrict users list to ADMIN role | UC-61 |
| FR-200 | Support case-insensitive `q` filter on username/email | UC-61 |
| FR-201 | Return paginated user list (limit 20) by `createdAt` desc | UC-61 |
| FR-202 | Set `User.banned = true` on admin ban | UC-62 |
| FR-203 | Set `User.banned = false` on admin unban | UC-62 |
| FR-204 | Block all write actions for banned users via `BannedUserGuard` | UC-62 |
| FR-205 | Restrict reports queue to ADMIN role | UC-63 |
| FR-206 | Return paginated OPEN reports (limit 20) by `createdAt` desc | UC-63 |
| FR-207 | Include reporter and post details in each report | UC-63 |
| FR-208 | Set `Report.status = "CLOSED"` on dismiss | UC-64 |
| FR-209 | Leave reported post unchanged on dismiss | UC-64 |
| FR-210 | Soft-delete reported post on admin delete action | UC-65 |
| FR-211 | Set `Report.status = "CLOSED"` after post deletion | UC-65 |
| FR-212 | Return public paginated feed without authentication | UC-66 |
| FR-213 | Omit interaction state from unauthenticated feed responses | UC-66 |
| FR-214 | Return post detail and comment thread without authentication | UC-67 |
| FR-215 | Omit interaction state from unauthenticated post detail responses | UC-67 |
| FR-216 | Return public user profile without authentication | UC-68 |
| FR-217 | Skip block filtering for unauthenticated profile requests | UC-68 |
| FR-218 | Return search results without authentication | UC-69 |
| FR-219 | Skip block filtering for unauthenticated search requests | UC-69 |
