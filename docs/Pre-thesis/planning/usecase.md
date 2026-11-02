# Use Cases — X Clone (Breadit)

> Living spec. Every use case has a stable ID so tickets and PRs can reference it.
> Tags: **[v1]** = first release · **[future]** = roadmap.
> Vote model: **Like only** (X-style). Bookmark = `SavedPosts`.

---

## 1. Actors

| Actor | Description |
|---|---|
| **Guest** | Unauthenticated visitor. Read-only access to public content. |
| **User** | Authenticated end-user (verified email). Default role after sign-up. |
| **Community Moderator** *(future)* | A `User` with moderator rights scoped to a single community. |
| **Admin** *(future)* | Site-wide privileged operator. Handles report queue, user lifecycle, system config. |
| **Email Service** | System actor. Triggered by backend events; sends transactional email. |

---

## 2. Guest

| ID | Tag | Title | Trigger | Main Flow |
|---|---|---|---|---|
| UC-G-01 | v1 | View public feed | Visits `/` while logged out | System returns paginated public posts (no personalization). |
| UC-G-02 | v1 | View post permalink | Opens shared link `/{user}/status/{postId}` | System returns post + thread; interaction CTAs prompt sign-in. |
| UC-G-03 | v1 | View public profile | Opens `/{username}` | System returns profile header + paginated posts. |
| UC-G-04 | v1 | Search content | Submits query in search bar | System returns matches across posts, users, hashtags. |
| UC-G-05 | v1 | Sign up | Submits sign-up form | System creates `User` (unverified) → triggers **UC-E-01**. |
| UC-G-06 | v1 | Sign in | Submits credentials / OAuth | System issues session; redirects to home feed. |

---

## 3. User

### 3.1 Feed & Discovery

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-FD-01 | v1 | Browse home feed | Posts from followed users, cursor-paginated (existing `InfiniteFeed`). |
| UC-U-FD-02 | v1 | Browse explore feed | Trending / recent posts beyond follow graph. |
| UC-U-FD-03 | v1 | Search posts / users / hashtags | Same surface as UC-G-04 but personalized (own posts, followed). |
| UC-U-FD-04 | v1 | View hashtag page | Lists posts tagged with `#tag`. *Extended by* UC-U-PM-01-ext-b. |

### 3.2 Post Management

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-PM-01 | v1 | Create post | Text up to 255 chars; reply requires `parentPostId`. |
| ↳ ext-a | v1 | Attach media | Images / video uploaded via ImageKit. |
| ↳ ext-b | v1 | Add hashtag | `#token` parsed at save; indexed for search. |
| ↳ ext-c | v1 | Mention user | `@username` resolved → triggers UC-U-NT-04. |
| UC-U-PM-02 | future | Edit own post | Within a grace window; show "edited" badge. |
| UC-U-PM-03 | v1 | Delete own post | Soft-delete; cascades to reposts/comments references. |
| UC-U-PM-04 | future | Pin post to profile | One pinned post per user. |
| UC-U-PM-05 | v1 | Report another user's post | Submits reason → enters Admin report queue (UC-A-03). |

### 3.3 Post Interaction

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-PI-01 | v1 | Like / unlike post | Toggle on `Like` table. |
| UC-U-PI-02 | v1 | Bookmark / unbookmark post | Toggle on `SavedPosts`. |
| UC-U-PI-03 | v1 | Repost | Plain repost via `rePostId`, no `desc`. |
| ↳ ext-a | v1 | Quote-repost | Repost with own `desc`. |
| UC-U-PI-04 | v1 | Reply / comment | New `Post` with `parentPostId` set. |
| UC-U-PI-05 | v1 | Share link | Copy permalink to clipboard / share-sheet. |

### 3.4 Social Graph

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-SG-01 | v1 | Follow / unfollow user | Toggle on `Follow`. Triggers UC-U-NT-03 for target. |
| ↳ ext-a | v1 | Toggle "notify on new post" | Per-followee preference. |
| UC-U-SG-02 | v1 | Block user | Bidirectional: blocked user can't see/interact with blocker; existing follows are removed. |

### 3.5 Messaging *(future)*

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-MG-01 | future | Send 1:1 direct message | Real-time via Socket.IO; media optional. |
| UC-U-MG-02 | future | Create / leave group DM | Up to N participants. |

### 3.6 Profile

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-PR-01 | v1 | Edit own profile | Avatar, cover, displayName, bio, location, job, website. |
| UC-U-PR-02 | v1 | View own profile | Tabs: posts / replies / media / likes. |
| UC-U-PR-03 | v1 | View another user's profile | Plus follow / block / message CTAs. |
| UC-U-PR-04 | v1 | List followers / followings | Paginated. |

### 3.7 Notifications

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-NT-01 | v1 | View notifications list | Like / reply / repost / follow / mention. |
| UC-U-NT-02 | v1 | Receive real-time notification | Socket.IO `getNotification` (already wired). |
| UC-U-NT-03 | v1 | Mark as read | Single + bulk "mark all read". |
| UC-U-NT-04 | v1 | Receive mention notification | Triggered by UC-U-PM-01-ext-c. |
| UC-U-NT-05 | future | Manage notification preferences | Email / push channel toggles per event type. |

### 3.8 Communities *(future)*

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-U-CM-01 | future | Browse communities | List + search. |
| UC-U-CM-02 | future | Join / leave community | Membership table. |
| UC-U-CM-03 | future | Create community | Creator becomes first moderator → UC-M-*. |
| UC-U-CM-04 | future | Post inside community | Standard post with `communityId`. |

---

## 4. Community Moderator *(future)*

Scoped to one community; inherits all User capabilities.

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-M-01 | future | Set / edit community rules | Markdown rules block. |
| UC-M-02 | future | Approve / remove community post | Pre/post-moderation modes. |
| UC-M-03 | future | Ban / unban member | Optional duration. |
| UC-M-04 | future | Promote member to moderator | Multiple mods allowed. |
| UC-M-05 | future | Transfer / close community | Ownership change or archive. |

---

## 5. Admin *(future)*

| ID | Tag | Title | Notes |
|---|---|---|---|
| UC-A-01 | future | Suspend / unsuspend user | Temporary or permanent. |
| UC-A-02 | future | Verify user | Sets `verified` badge on profile. |
| UC-A-03 | future | Process report queue | Inputs from UC-U-PM-05; actions: dismiss / remove / suspend. |
| UC-A-04 | future | Delete / transfer community | When moderator action insufficient. |
| UC-A-05 | future | Configure system | Feature flags, rate limits, content filters. |
| UC-A-06 | future | View analytics dashboard | DAU/MAU, post volume, report rate. |

---

## 6. Email Service (system actor)

Triggered by backend events; renders templates and dispatches via provider.

| ID | Tag | Title | Trigger |
|---|---|---|---|
| UC-E-01 | v1 | Send verification email | UC-G-05 sign-up. |
| UC-E-02 | v1 | Send password-reset email | "Forgot password" request. |
| UC-E-03 | future | Send security alert | New device / suspicious sign-in. |
| UC-E-04 | future | Send digest / mention email | Per UC-U-NT-05 preferences. |

---

## 7. Glossary

| Term used here | Equivalent |
|---|---|
| **Bookmark** | `SavedPosts` row / "Save post" |
| **Community** | "Group" in the original draft |
| **Quote-Repost** | Repost with `desc` (repost-with-comment) |
| **Mention** | `@username` token inside `Post.desc` |
| **Like** | Single positive reaction (no down-vote) |

---

## 8. Mapping to Original Draft

| Original draft item | Where it lives now |
|---|---|
| Guest: View posts / Search / Sign up & Login | UC-G-01..06 |
| User · Browse / Search posts | UC-U-FD-01..03 |
| User · Save posts | UC-U-PI-02 (Bookmark) |
| User · Chatting | UC-U-MG-01..02 *(future)* |
| User · Create post + media + hashtag | UC-U-PM-01 + ext-a/-b |
| User · Delete / report post | UC-U-PM-03, UC-U-PM-05 |
| User · Up vote / Down vote | Resolved → **Like only** (UC-U-PI-01) |
| User · Repost / Comment / Reply | UC-U-PI-03, UC-U-PI-04 |
| User · Follow + notification on new post | UC-U-SG-01 + ext-a |
| User · Edit / view profile | UC-U-PR-01..04 |
| User · View notification | UC-U-NT-01..04 |
| User · Group: join / leave / create / rules / control | UC-U-CM-* + UC-M-* *(future)* |
| Admin · Manage user / group | UC-A-01, UC-A-02, UC-A-04 |
| Admin · Approve content | UC-A-03 (report queue) |
| Admin · Config system | UC-A-05 |
| Admin · Analytic and monitor | UC-A-06 |
| Email · Send verification | UC-E-01 (+ UC-E-02..04 added) |
