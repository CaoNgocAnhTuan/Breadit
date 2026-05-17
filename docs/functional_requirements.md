# Functional Requirements — Breadit (Social Network)

This document outlines the core functional requirements of the Breadit platform, seamlessly merging thesis-ready structured tables with the underlying technical implementations of the NestJS + Next.js monorepo.

## 1. Actors and Roles

| Role | Description |
| :--- | :--- |
| **Guest** | Unauthenticated visitor. Can view public feeds and profiles but cannot interact. |
| **User** | Authenticated user with a verified email. Can create content, interact, and message. |
| **Community Moderator** | A User with elevated permissions within a specific community (Mod/Owner). |
| **Admin** | Site-wide administrator (`User.role = ADMIN`) with access to global moderation. |

---

## 1.4.1.1 Authentication & Account Verification

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-AUTH-01** | The system shall allow users to register an account using a unique username, email, and password. | Must | Sign Up, Log In |
| **FR-AUTH-02** | The system shall implement secure password hashing (e.g., bcrypt) before storing credentials. | Must | Sign Up, Log In |
| **FR-AUTH-03** | The system shall send a 6-digit verification code (OTP) to the user's email to verify account ownership. | Must | Verify Email |
| **FR-AUTH-04** | The system shall authenticate users and issue a secure httpOnly JWT session cookie named `breadit_session`. | Must | Sign Up, Log In |
| **FR-AUTH-05** | The system shall provide a "Forgot Password" feature allowing users to reset their credentials securely. | Should | Reset Password |

**Technical Implementation Notes:**
- Registration uses `POST /api/auth/register` with `bcrypt` (10 salt rounds).
- Email verification enforces OTP. Unverified users are blocked from guarded routes via Guards.
- Auth mutations are protected by `@nestjs/throttler` (e.g., 10 requests per 60s).

---

## 1.4.1.2 Feeds & Discovery

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-DISC-01** | The system shall generate a chronologically sorted home feed consisting of posts from followed users. | Must | View Public Feed |
| **FR-DISC-02** | The system shall provide an explore feed sorted by like count (trending), excluding community posts. | Must | View Public Feed |
| **FR-DISC-03** | The system shall provide dedicated feeds for specific hashtags and communities. | Must | View Public Feed |
| **FR-DISC-04** | The system shall perform case-insensitive global searches across posts, users, hashtags, and communities. | Must | Search Content |
| **FR-DISC-05** | The system shall debounce search input from the UI and provide a live dropdown of results. | Should | Search Content |

**Technical Implementation Notes:**
- **Feeds:** All feeds implement cursor-based pagination for high performance.
- **Search API:** `GET /api/search?q=` runs parallel queries using Prisma (`Promise.all`).
- **Caching:** Search results are cached using a Redis-backed `CacheService` to reduce database load.

---

## 1.4.1.3 Post Management

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-POST-01** | The system shall allow authenticated users to create text posts with a limit of 255 characters. | Must | Create Post |
| **FR-POST-02** | The system shall allow users to attach multi-media files managed via Cloudinary or local Sharp processing. | Must | Create Post |
| **FR-POST-03** | The system shall automatically parse and index hashtags (#tokens) included in the post text. | Must | Create Post |
| **FR-POST-04** | The system shall allow users to edit the text of their previously published posts or comments. | Should | Edit/Delete Post |
| **FR-POST-05** | The system shall allow users to soft-delete their own posts, effectively hiding them from all feeds. | Must | Edit/Delete Post |

**Technical Implementation Notes:**
- Post description limit is strongly enforced (`VarChar(255)`).
- Media uses **Cloudinary** (if keys provided) or falls back to local disk.
- Deletion uses a **soft-delete** strategy (`deletedAt`), maintaining referential integrity.

---

## 1.4.1.4 Post Interaction

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-INT-01** | The system shall allow users to like or unlike posts and comments to express agreement. | Must | Interact with Post |
| **FR-INT-02** | The system shall allow users to reply to existing posts, creating a threaded comment structure. | Must | Threaded Comments |
| **FR-INT-03** | The system shall allow users to perform plain reposts or quote-reposts to their own profile feed. | Must | Interact with Post |
| **FR-INT-04** | The system shall allow users to privately save posts to a bookmark list for later reading. | Should | Interact with Post |

**Technical Implementation Notes:**
- Reposting is supported natively via a self-referential post model in Prisma.

---

## 1.4.1.5 User Relationship Management

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-REL-01** | The system shall allow users to follow or unfollow other accounts to customize their home timeline. | Must | Follow/Unfollow |
| **FR-REL-02** | The system shall allow users to explicitly mention followed users using the @username syntax. | Should | Create Post, Comments |
| **FR-REL-03** | The system shall allow users to block accounts bidirectionally, restricting profile access and messaging. | Must | Block/Unblock |

**Technical Implementation Notes:**
- **Bidirectional Blocking:** A block strictly severs mutual follows. Blocked users receive `profileRestricted: true` on API calls and return 404s for posts to ensure strict privacy.
- Mentions (`@username`) trigger notifications ONLY if the author follows the mentioned user.

---

## 1.4.1.6 Profile Management

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-PROF-01** | The system shall allow users to view profiles with dedicated tabs for Posts, Replies, Media, and Likes. | Must | Manage Profile |
| **FR-PROF-02** | The system shall allow users to update personal info, including bio (up to 160 chars), location, and website. | Must | Manage Profile |
| **FR-PROF-03** | The system shall allow users to upload and crop custom images for their avatar and cover photo. | Should | Manage Profile |

**Technical Implementation Notes:**
- Field max lengths are enforced directly in NestJS DTOs via `class-validator`.

---

## 1.4.1.7 Direct Messaging

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-MSG-01** | The system shall allow users to establish 1:1 real-time direct messaging threads with database persistence. | Must | Send Direct Message |
| **FR-MSG-02** | The system shall allow users to attach images and videos securely within direct message conversations. | Should | Send Direct Message |
| **FR-MSG-03** | The system shall maintain and update unread message badge counts dynamically. | Must | Send Direct Message |

**Technical Implementation Notes:**
- Blocked pairs cannot open or continue DMs, nor will their history appear in unread totals.

---

## 1.4.1.8 Real-time Notifications

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-NOTI-01** | The system shall dispatch real-time Socket.IO alerts for likes, replies, reposts, mentions, and follows. | Must | View Notifications |
| **FR-NOTI-02** | The system shall securely store notifications in the database to track unread and read states over time. | Must | View Notifications |
| **FR-NOTI-03** | The system shall scale real-time broadcasting across multiple instances using a Redis adapter. | Must | View Notifications |

**Technical Implementation Notes:**
- Notifications persist in the database with a `readAt` timestamp.
- **Socket.IO gateway** strictly validates the `breadit_session` cookie on connection.

---

## 1.4.1.9 Community Management

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-COMM-01** | The system shall allow users to create communities and automatically inherit the Owner/Moderator role. | Must | Create Community |
| **FR-COMM-02** | The system shall allow users to browse existing communities and explicitly join or leave them. | Must | Join/Leave Community |
| **FR-COMM-03** | The system shall allow community moderators to define and display specific rules for their community. | Must | Manage Community |
| **FR-COMM-04** | The system shall allow members to submit posts within a community, entering a moderation queue if required. | Must | Create Post |
| **FR-COMM-05** | The system shall allow moderators to approve/reject pending posts and ban users from the community. | Must | Manage Community |

**Technical Implementation Notes:**
- Community posts are intentionally omitted from the main Explore feed and global post search to maintain context.
- Pending posts enter a moderation queue, triggering `COMMUNITY_POST` notifications for staff.
- Approved auto-posts trigger `COMMUNITY_NEW_POST` notifications to members.

---

## 1.4.1.10 Administrative Moderation

| ID | Requirement Description | Priority | Related Use Case(s) |
| :--- | :--- | :--- | :--- |
| **FR-MOD-01** | The system shall provide a global admin console to view and search a list of all registered users. | Must | Manage Users |
| **FR-MOD-02** | The system shall allow administrators to temporarily or permanently ban users from the platform. | Must | Manage Users |
| **FR-MOD-03** | The system shall maintain a queue of user-reported posts and push real-time REPORT alerts to admins. | Must | Handle Reports |
| **FR-MOD-04** | The system shall allow administrators to permanently delete reported content or dismiss invalid reports. | Must | Moderate Content |

**Technical Implementation Notes:**
- Admins receive real-time `REPORT` notifications over WebSockets.
- Reported posts enter a dedicated queue handled by `AdminService` routes.
