# Functional Requirements - Breadit (X Clone)

This document outlines the detailed functional requirements for Breadit, a full-stack social media platform.

## 1. Actors and Roles

| Role | Description |
| :--- | :--- |
| **Guest** | Unauthenticated visitor. Can view public content but cannot interact. |
| **User** | Authenticated user with a verified email. Can create content, interact, and message. |
| **Community Moderator** | A User with elevated permissions within a specific community (Mod/Owner). |
| **Admin** | Site-wide administrator with access to the Admin Console and global moderation. |

---

## 2. Authentication & Account Management

- **UC-AUTH-01: Registration:** Users can sign up with a unique username, email, and password.
- **UC-AUTH-02: Email Verification:** New accounts must be verified via a 6-digit code sent to their email before they can post content.
- **UC-AUTH-03: Login/Logout:** Secure session management using HTTP-only JWT cookies (`breadit_session`).
- **UC-AUTH-04: Password Recovery:** Users can request a password reset link via email using a secure UUID-based token.
- **UC-AUTH-05: Account Security:** Rate limiting on auth endpoints (10 req/min for login/register) to prevent brute-force attacks.

---

## 3. User Profile Management

- **UC-PROF-01: Profile Customization:** Users can edit their display name, bio, location, job, and website.
- **UC-PROF-02: Media Branding:** Users can upload a profile avatar (square) and a cover image (wide).
- **UC-PROF-03: Profile Views:** 
    - View own or others' profiles.
    - Tabbed navigation: Posts, Replies, Media, and Likes.
- **UC-PROF-04: Theme Preference:** Users can toggle between Light, Dark, and System themes.

---

## 4. Content Creation & Discovery

- **UC-POST-01: Create Post:** Users can create posts with text (up to 255 chars).
- **UC-POST-02: Multi-media Attachments:** Support for up to 10 attachments per post (Images/Videos) via Cloudinary CDN or local fallback.
- **UC-POST-03: Hashtags:** Automatic parsing of `#tokens` in post descriptions. Tags are indexed for discovery.
- **UC-POST-04: Mentions:** Automatic parsing of `@username` tokens. Mentioned users receive real-time notifications.
- **UC-POST-05: Feed Discovery:**
    - **Home Feed:** Personalized feed showing posts from followed users.
    - **Explore Feed:** Global trending posts based on engagement (likes).
    - **Hashtag Feed:** Posts specifically tagged with a given hashtag.
- **UC-POST-06: Search:** Global search functionality for Posts, Users, Hashtags, and Communities using parallel query matching.
- **UC-POST-07: Deletion:** Users can soft-delete their own posts (retains data in DB but hides from all feeds).

---

## 5. Social Interactions

- **UC-INT-01: Like/Unlike:** Users can toggle likes on posts.
- **UC-INT-02: Reposting:** 
    - **Plain Repost:** Share a post directly to followers.
    - **Quote Repost:** Share a post with additional commentary.
- **UC-INT-03: Bookmarking:** Users can save posts to a private "Bookmarks" list.
- **UC-INT-04: Threaded Comments:** Users can reply to any post, creating a hierarchical comment thread.
- **UC-INT-05: Follow Graph:** 
    - Users can follow/unfollow others.
    - View followers and following lists.
    - Optional "Notify on new post" toggle for specific followees.
- **UC-INT-06: Safety - Blocking:** Bidirectional blocking. Blocked users cannot see each other's posts, profiles, or notifications. Existing follows are automatically severed.

---

## 6. Real-time Notifications

- **UC-NOTI-01: Notification Types:** Persisted and real-time alerts for:
    - Likes, Reposts, Replies, Follows, and Mentions.
    - Community-specific events (Pending approval, New posts).
    - Administrative reports.
- **UC-NOTI-02: Persistence:** Notifications are stored in the database and show an "unread" status.
- **UC-NOTI-03: Real-time Delivery:** Powered by Socket.IO for instant delivery without page refreshes.
- **UC-NOTI-04: Bulk Actions:** "Mark all as read" functionality.

---

## 7. Direct Messaging (DMs)

- **UC-MSG-01: 1:1 Messaging:** Secure, private real-time messaging between users.
- **UC-MSG-02: Conversation Management:** List of active conversations with last-message previews and unread badges.
- **UC-MSG-03: Media Support:** Ability to view images/videos within chat threads using a full-screen Lightbox (MediaViewer).

---

## 8. Communities (Groups)

- **UC-COMM-01: Community Lifecycle:** Users can create communities with a unique slug, name, and description.
- **UC-COMM-02: Roles & Permissions:** 
    - **Owner:** Full control, including transfer and deletion.
    - **Moderator:** Can manage rules, ban members, and moderate content.
    - **Member:** Can join, leave, and post.
- **UC-COMM-03: Moderation Queue:** Community staff can approve or reject posts submitted by members.
- **UC-COMM-04: Rules Engine:** Staff can define and display community-specific rules.
- **UC-COMM-05: Member Bans:** Moderators can ban users from a community, preventing them from joining, viewing, or posting.
- **UC-COMM-06: Feed Privacy:** Community posts are excluded from global explore and search feeds to maintain group focus.

---

## 9. Admin Console

- **UC-ADMN-01: User Management:** Search and list all users. Capability to globally ban/unban accounts.
- **UC-ADMN-02: Report Handling:** Centralized queue for reported posts. Admins can:
    - **Dismiss:** Close the report as invalid.
    - **Delete Post:** Remove the offending content and close the report.
- **UC-ADMN-03: Real-time Alerts:** Admins receive instant notifications when new content is reported.

---

## 10. System Requirements (Functional Context)

- **Scalability:** Real-time components use Redis for Socket.IO scaling across multiple replicas.
- **Performance:** Debounced search, cursor-based pagination for feeds, and optimized media rendering via Cloudinary.
- **Reliability:** Global error boundaries in the frontend and a centralized exception filter in the backend for consistent error reporting.
