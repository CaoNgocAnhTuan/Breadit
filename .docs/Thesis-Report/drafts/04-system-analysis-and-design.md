# Chapter 4. System Analysis and Design

> **Outline with diagram scripts, 2026-11-19.** The text is not written yet. Budget: about 14 pages (see `Report Architecture.md`). Each figure below is a Mermaid script, checked against the code and `apps/backend/prisma/schema.prisma` on 2026-11-19. The author turns each one into an image: paste it into the Mermaid web editor (mermaid.live) and export it, or into draw.io (Arrange → Insert → Advanced → Mermaid) and redraw it there. Save the image in `images/`, with the script next to it as a `.mmd` file. Remove this box before the final version.

This chapter designs the platform (contributions C1 and C3) and shows where the ranking of C2 plugs in. Chapter 3 gives the ranking method; Chapter 5 describes how the design is built.

## 4.1 Requirements (about 2 pages)

- Functional requirements by module (posts, interactions, follows, communities, messages, notifications, search, admin, feed), as one table.
- Non-functional requirements: security (auth, the S1 and S5 fixes), real-time push, reproducibility of the ranking (Class D), performance as measured in E7 only.
- Sources: pre-thesis `Non-Functional-Requirements.md` and Chapter 3 of the pre-thesis report; `.docs/Bugs Report.md` (system inventory).

## 4.2 Use cases (about 3 pages)

- One overview use case diagram with the actors Guest, User, Community owner or moderator, and Admin (Figure 4.1).
- Three or four use case specifications as tables (actor, precondition, main flow, alternative flows): read the "For You" feed (with the `algo` option), send a direct message, join a community and post in it, ban a user.

**Figure 4.1. Use case overview.**

Mermaid has no use case type, so this is a flowchart in UML form: the actors are outside the "Breadit" box, and the use cases are the ovals inside it. In draw.io, the actors can become stick figures.

```mermaid
flowchart LR
    Guest["«actor»<br/>Guest"]
    User["«actor»<br/>User"]
    Mod["«actor»<br/>Community owner<br/>or moderator"]
    Admin["«actor»<br/>Admin"]
    Mail["«system»<br/>Email service (SMTP)"]

    subgraph Breadit["Breadit"]
        UC1(["Sign up"])
        UC2(["Verify email with a code"])
        UC3(["Sign in"])
        UC4(["Reset password"])
        UC5(["Sign out"])
        UC6(["Read the feeds: For You,<br/>Following, Communities, Explore"])
        UC7(["Create, edit or delete a post"])
        UC8(["Like, repost or save a post"])
        UC9(["Comment and reply"])
        UC10(["Follow or block a user"])
        UC11(["Join a community and post in it"])
        UC12(["Send a direct message"])
        UC13(["Get real-time notifications"])
        UC14(["Search posts, users and hashtags"])
        UC15(["Edit the profile"])
        UC16(["Report a post"])
        UC17(["Moderate a community:<br/>approve posts, rules, bans"])
        UC18(["Ban or unban a user"])
        UC19(["Review reports:<br/>dismiss, or delete the post"])
    end

    Guest --- UC1
    Guest --- UC3
    Guest --- UC4
    UC1 -.->|"«include»"| UC2
    User --- UC5
    User --- UC6
    User --- UC7
    User --- UC8
    User --- UC9
    User --- UC10
    User --- UC11
    User --- UC12
    User --- UC13
    User --- UC14
    User --- UC15
    User --- UC16
    Mod -->|"is a"| User
    Mod --- UC17
    UC18 --- Admin
    UC19 --- Admin
    UC2 --- Mail
    UC4 --- Mail
```

Checked against: every use case has a route (`api/auth`, `api/posts`, `api/users`, `api/communities`, `api/conversations`, `api/notifications`, `api/search`, `api/hashtags`, `api/admin`). The web app sends a guest to `/sign-in` for every page except sign-up, verify, sign-in, forgot-password and reset (`apps/frontend/src/middleware.ts`, `PUBLIC_PATHS`). So the Guest has only the three use cases above, even though the API also has guest reads (`OptionalJwtAuthGuard`). The admin routes need `RolesGuard` with the `ADMIN` role.

## 4.3 Activity diagrams (about 2 pages)

**Figure 4.2. Sign up with email verification.**

```mermaid
flowchart TD
    S((Start)) --> A1["Fill in the sign-up form:<br/>username, email, password"]
    A1 --> A2["POST /api/auth/register"]
    A2 --> D1{"Input valid?"}
    D1 -->|no| R1["400: show the errors"]
    R1 --> A1
    D1 -->|yes| D2{"Email or username<br/>already taken?"}
    D2 -->|yes| R2["409: show the error"]
    R2 --> A1
    D2 -->|no| A3["Hash the password (bcrypt)<br/>and create the user,<br/>emailVerified empty"]
    A3 --> A4["Make a 6-digit code, valid 15 minutes,<br/>and email it"]
    A4 --> A5["Open /verify and enter the code"]
    A5 --> A6["POST /api/auth/verify"]
    A6 --> D3{"Code right and<br/>not expired?"}
    D3 -->|no| D4{"Ask for a new code?"}
    D4 -->|yes| A7["POST /api/auth/verify/resend:<br/>a new code replaces the old one"]
    A7 --> A5
    D4 -->|no| A5
    D3 -->|yes| A8["Set emailVerified,<br/>delete the code"]
    A8 --> A9["Go to /sign-in?verified=1"]
    A9 --> E(((End)))
```

Checked against: `auth.controller.ts` (`register`, `verify`, `verify/resend`), `auth.service.ts` (`register`, `createVerificationCode`, `consumeVerificationCode`, `verifyEmail`), `dto/register.dto.ts` (username 3–30 characters of letters, digits or `_`; a valid email; password at least 6 characters), and the pages `sign-up`, `verify` and `sign-in`.
- If the email cannot be sent, the error is only logged; the user is still created and can ask for a new code.
- An unverified user can sign in, but `EmailVerifiedGuard` refuses every write.
- Throttle: 10 requests per minute for register and verify, 5 for resend.

**Figure 4.3. Publish a post.**

```mermaid
flowchart TD
    S((Start)) --> A1["Write the text, add media,<br/>maybe pick a community"]
    A1 --> A2["POST /api/posts (multipart)"]
    A2 --> D1{"Signed in, not banned,<br/>email verified?"}
    D1 -->|no| R1["401 or 403"]
    R1 --> E1(((End)))
    D1 -->|yes| D2{"Text at most 255 characters,<br/>and text or media?"}
    D2 -->|no| R2["400"]
    R2 --> E1
    D2 -->|yes| D3{"Community picked?"}
    D3 -->|yes| D4{"Community exists,<br/>user not banned there,<br/>user is a member?"}
    D4 -->|no| R3["400 or 403"]
    R3 --> E1
    D4 -->|yes| A3
    D3 -->|no| A3["Upload the media<br/>(Cloudinary or local disk)"]
    A3 --> A4["Save the post. isApproved is true outside a community.<br/>In a community, it is true only for the owner or a moderator"]
    A4 --> A5["Bump the author's v:user cache version"]
    A5 --> A6["Save the hashtags of the text, in lower case"]
    A6 --> A7["Save the mentions of users the author follows,<br/>and notify them (MENTION)"]
    A7 --> D5{"Community post?"}
    D5 -->|no| E2(((End)))
    D5 -->|"yes, by the owner or a moderator"| A8["Notify all other members<br/>(COMMUNITY_NEW_POST)"]
    D5 -->|"yes, by a member"| A9["The post waits for approval.<br/>Notify the owners and moderators<br/>(COMMUNITY_POST)"]
    A8 --> E2
    A9 --> E2
```

Checked against: `posts.controller.ts` (`@Post()` with `JwtAuthGuard`, `BannedUserGuard`, `EmailVerifiedGuard`), `posts.service.ts` `create` (`assertPostText`, the community, ban and membership checks, `isApproved`, `incrNumber('v:user')`, hashtags, mentions, the community notifications), `common/limits.ts` (`POST_DESC_MAX = 255`). A mention is saved only for a user the author follows. Hashtags and mentions are read only when the post has text.

**Figure 4.4. Get one page of a feed.**

```mermaid
flowchart TD
    S((Start)) --> A1["GET /api/posts with the cursor and<br/>feed, user, communityId, algo, asOf"]
    A1 --> D1{"Options valid? asOf only when enabled,<br/>algo only on For You and signed in"}
    D1 -->|no| R1["400 or 401"]
    R1 --> E1(((End)))
    D1 -->|yes| D2{"For You, signed in,<br/>no algo given?"}
    D2 -->|yes| A2["algo = FEED_DEFAULT_ALGO<br/>(empty when not set)"]
    D2 -->|no| A3
    A2 --> A3["Read the clock once"]
    A3 --> A4["Cache key: viewer, mode, cursor,<br/>v:user version, asOf"]
    A4 --> D3{"Page in the cache?"}
    D3 -->|yes| R2["Return the cached page"]
    R2 --> E1
    D3 -->|no| D4{"algo set?"}
    D4 -->|yes| A5["FeedService.rank at time t:<br/>pool, as-of features, scorer, rankPool"]
    A5 --> A6["Take the 10 posts after the cursor.<br/>Next cursor: t:score:id"]
    D4 -->|no| A7["Pick the mode: community, Explore,<br/>Following, Communities, profile,<br/>For You (newest first) or guest"]
    A7 --> A8["Query: no deleted posts, no blocked peers.<br/>Community posts only in the community feeds,<br/>and only approved ones"]
    A8 --> A9["Order newest first<br/>(Explore: the BL2 score)"]
    A9 --> A10["Take one page"]
    A6 --> A11["Store the page for 10 s"]
    A10 --> A11
    A11 --> R3["Return posts, hasMore, nextCursor"]
    R3 --> E1
```

Checked against: `feed/feed.options.ts` (`resolveFeedOptions`), `posts.service.ts` `findAll` (lines 186–300: the clock read once, the cache key, the `algo` branch, the mode branches) and `algoPage` (lines 150–184).

## 4.4 Sequence diagrams (about 3 pages)

**Figure 4.5. Sign in, a signed-in request, sign out.**

```mermaid
sequenceDiagram
    autonumber
    actor U as User
    participant B as Browser
    participant AC as AuthController
    participant AS as AuthService
    participant G as JwtAuthGuard
    participant DB as Postgres
    participant R as Redis
    U->>B: email and password
    B->>AC: POST /api/auth/login
    AC->>AS: login(dto)
    AS->>DB: find the user by email
    AS->>AS: bcrypt.compare(password, hash)
    alt wrong email or password
        AS-->>B: 401 Invalid email or password
    else right
        AS->>AS: signJwt: HS256, a new jti, 30 days
        AS-->>B: 200 user, Set-Cookie breadit_session (httpOnly)
    end
    Note over B,R: Every later request sends the cookie
    B->>G: GET /api/... with the cookie
    G->>G: verifyJwt
    G->>R: GET auth:blacklist:jti
    R-->>G: not found
    G->>G: req.user = id, username, emailVerified, role, banned
    U->>B: sign out
    B->>AC: POST /api/auth/logout with the cookie
    AC->>AS: logout(token)
    AS->>R: SET auth:blacklist:jti until the token expires
    AS-->>B: 200, clear the cookie
    B->>G: a request with the old token
    G->>R: GET auth:blacklist:jti
    R-->>G: found
    G-->>B: 401
```

Checked against: `auth.controller.ts` (`login`, `logout`), `auth.service.ts` (`signJwt`, `setSessionCookie`, `login`, `logout`, `BLACKLIST_PREFIX`), `jwt.guard.ts`. Sign-in does not refuse a banned or unverified user; `BannedUserGuard` and `EmailVerifiedGuard` stop their writes later.

**Figure 4.6. Like a post, with the notification saved and pushed.**

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice's browser
    participant C as InteractionsController
    participant S as InteractionsService
    participant DB as Postgres
    participant N as NotificationsService
    participant GW as Gateway and Redis adapter
    participant B as Bob's browser
    Note over B,GW: Bob's socket joined the room "bob" when it connected
    A->>C: POST /api/posts/:id/like with the cookie
    C->>C: JwtAuthGuard, BannedUserGuard (reads the DB), EmailVerifiedGuard
    C->>S: toggleLike(alice, postId)
    S->>DB: find the post, not deleted
    alt no such post
        S-->>A: 404 Post not found
    else found
        S->>DB: find Alice's like on the post
        alt already liked
            S->>DB: delete the like
        else not liked
            S->>DB: create the like
            S-)N: emit(LIKE, alice, bob, postId), not awaited
            Note over N: skipped when Alice likes her own post
            N->>DB: save the Notification
            N->>DB: find Bob's username
            N->>GW: server.to("bob").emit("getNotification")
            GW-->>B: getNotification
        end
        S->>DB: count the likes of the post
        S-->>A: 200 liked, count
    end
```

Checked against: `interactions.controller.ts` lines 33–38, `interactions.service.ts` (`assertPostLive`, `toggleLike`), `notifications.service.ts` `emit` (lines 17–43).

**Figure 4.7. A direct message in real time.**

```mermaid
sequenceDiagram
    autonumber
    participant A as Alice's browser
    participant C as MessagesController
    participant S as MessagesService
    participant DB as Postgres
    participant K as Redis
    participant GW as Gateway and Redis adapter
    participant B as Bob's browser
    B->>GW: connect with the cookie
    GW->>GW: check the cookie and the logout blacklist
    GW->>GW: join the room "bob"
    A->>C: POST /api/conversations/:id/messages with the cookie
    C->>C: JwtAuthGuard, BannedUserGuard, EmailVerifiedGuard
    C->>S: sendMessage(id, alice, body or media)
    S->>DB: Alice is a member, and no block between the two
    alt not a member, blocked, or no body and no media
        S-->>A: 403
    else ok
        S->>DB: one transaction: create the message, update the conversation time
        S->>DB: find the other member (Bob)
        S->>GW: server.to("bob").emit("newMessage")
        GW-->>B: newMessage
        B->>B: show the message, update the unread count
        S->>K: delete Bob's unread-count cache entry
        S-->>A: 201 the message
    end
```

Checked against: `messages.controller.ts` lines 27–28 (`api/conversations`, `JwtAuthGuard`, `BannedUserGuard`) and 83–91 (`EmailVerifiedGuard`, `sendMessage`), `messages.service.ts` `sendMessage` (lines 275–325, `assertMember`, `assertConversationNotBlocked`), `notifications.gateway.ts` (`handleConnection` joins the username room).

**Figure 4.8. "For You" with `algo=social`.**

```mermaid
sequenceDiagram
    autonumber
    participant UI as Browser (InfiniteFeed)
    participant C as PostsController
    participant S as PostsService
    participant K as Redis cache
    participant F as FeedService
    participant DB as Postgres
    participant R as ranking package
    UI->>C: GET /api/posts?algo=social&cursor=1
    C->>S: findAll(cursor, ..., algo, asOf)
    S->>S: resolveFeedOptions, t = asOf, the time in the cursor, or the clock
    S->>K: get the page (the key has algo, cursor, v:user, asOf)
    alt hit
        K-->>S: cached page
    else miss
        S->>F: rank(user, social, t)
        F->>DB: 1. root posts in [t − W, t), community posts included
        F->>DB: 2. the user's follows, memberships, positives before t
        F->>DB: 3. blocked peers
        F->>R: userFeaturesAsOf, buildPool
        F->>DB: 4. likes, comments, reposts on the pool posts before t
        F->>R: postFeaturesAsOf per pool post, scorer(H), rankPool
        R-->>F: post ids in order
        F-->>S: (id, score) in rank order
        S->>DB: load the 10 posts after the cursor, with counts and media
        S->>K: store the page, 10 s
    end
    S-->>C: posts, hasMore, nextCursor "t:score:id"
    C-->>UI: JSON
```

Checked against: `posts.service.ts` lines 150–222 (`algoPage`, `findAll`), `feed/feed.service.ts` `rank` (lines 53–158, the four loads and the package calls). The same diagram is in Guidance Manual 08 §4.

## 4.5 Architecture and modules (about 1.5 pages)

**Figure 4.9. The components.**

```mermaid
flowchart LR
    B["Web browser"]
    subgraph FE["Frontend: Next.js 15, React 19"]
        MW["middleware.ts<br/>session cookie check"]
        SC["Server components<br/>serverFetch()"]
        CC["Client components<br/>TanStack Query, api()"]
    end
    subgraph BE["Backend: NestJS 10 on Fastify"]
        REST["REST controllers /api/...<br/>guards, ValidationPipe, throttler"]
        SVC["Services: auth, posts, feed, users,<br/>communities, messages, notifications, admin"]
        GW["Socket.IO gateway<br/>NotificationsGateway"]
    end
    RANK["@breadit/ranking<br/>pure ranking package"]
    PG[("PostgreSQL 16<br/>via Prisma 6")]
    RD[("Redis 7<br/>cache, logout blacklist,<br/>throttler, socket adapter")]
    UP[("Uploads<br/>Cloudinary or local disk")]
    SMTP["SMTP server<br/>verification and reset email"]

    B --> MW
    MW --> SC
    B --> CC
    SC -->|"HTTP, forwards the cookie"| REST
    CC -->|"HTTP with the cookie"| REST
    B <-->|"WebSocket with the cookie"| GW
    REST --> SVC
    SVC -->|"plain arrays in, post ids out"| RANK
    SVC --> PG
    SVC <--> RD
    GW <--> RD
    SVC --> UP
    SVC -->|"emit to a user room"| GW
    SVC --> SMTP
```

Checked against: CLAUDE.md "Architecture"; `apps/frontend/src/middleware.ts`, `src/lib/session.ts`, `src/lib/api.ts`; `notifications.gateway.ts`; `cache.service.ts`; `uploads/`; `AuthService.sendMail`. The same parts are in Guidance Manual 12 §1.

**Figure 4.10. The ranking package boundary.**

```mermaid
flowchart LR
    UI["Frontend<br/>Feed, InfiniteFeed"]
    API["PostsController<br/>GET /api/posts"]
    SVC["PostsService.findAll<br/>mode, cache, page"]
    FS["FeedService.rank<br/>loads the data"]
    RANK["@breadit/ranking<br/>buildPool, as-of features,<br/>scorer, rankPool"]
    PG[("Postgres")]
    RD[("Redis<br/>10 s pages")]
    EVAL["eval/ harness<br/>offline, CSV data"]

    UI -->|"cursor, feed, algo"| API
    API --> SVC
    SVC <--> RD
    SVC -->|"algo set"| FS
    SVC -->|"Explore score (BL2)"| RANK
    FS -->|"plain arrays"| RANK
    RANK -->|"ordered post ids"| FS
    FS --> PG
    SVC -->|"load the page's posts"| PG
    EVAL -.->|"same functions"| RANK
```

Checked against: `posts.controller.ts` (`@Controller('api/posts')`), `posts.service.ts` (`findAll`, the `feedService.rank` call, Explore with `computeExploreScoreFixed`), `feed/feed.service.ts`, `apps/frontend/src/components/Feed.tsx` and `InfiniteFeed.tsx`. The same diagram is in Guidance Manual 08 §1.

## 4.6 Database design (about 2.5 pages)

- One ERD on one page (Figure 4.11).
- A short table of the main entities (User, Post, Like, Comment, Follow, Community, CommunityMember, Conversation, Message, Notification, Block) and the rules the design keeps: soft delete, approved community posts, membership for community posts.

**Figure 4.11. The ERD.**

The script was made from `apps/backend/prisma/schema.prisma` on 2026-11-19, with a one-off script that is not in the repo.
- **Tables:** 23 of the 25 models. `Account` and `Session` are left out, because no code reads them (Bugs Report R4); the caption should say so.
- **Fields:** each table shows its keys (PK, FK, UK), its enum and Boolean fields, and its `DateTime` fields except `updatedAt`. The other fields are in the schema; the caption should say so.
- **Relations:** each line is one foreign key, named by its field. There are 39 lines: the 41 relations of the schema, without the 2 of `Account` and `Session`.

```mermaid
erDiagram
    User {
        String id PK
        String email UK
        String username UK
        DateTime emailVerified
        Role role
        Boolean banned
        DateTime createdAt
    }
    VerificationToken {
        String identifier UK "unique pair"
        String token UK "unique pair"
        DateTime expires
    }
    Post {
        Int id PK
        DateTime createdAt
        DateTime deletedAt
        Boolean isSensitive
        Boolean isApproved
        String userId FK
        Int rePostId FK
        Int parentPostId FK
        Int communityId FK
    }
    Hashtag {
        Int id PK
        String tag UK
        DateTime createdAt
    }
    PostTag {
        Int postId PK, FK
        Int hashtagId PK, FK
    }
    Like {
        Int id PK
        DateTime createdAt
        String userId FK
        Int postId FK
    }
    SavedPosts {
        Int id PK
        DateTime createdAt
        String userId FK
        Int postId FK
    }
    Notification {
        Int id PK
        NotificationType type
        String recipientId FK
        String actorId FK
        Int postId FK
        Int commentId FK
        DateTime readAt
        DateTime createdAt
    }
    Follow {
        Int id PK
        DateTime createdAt
        Boolean notify
        String followerId FK
        String followingId FK
    }
    Block {
        Int id PK
        DateTime createdAt
        String blockerId FK, UK "unique pair"
        String blockedId FK, UK "unique pair"
    }
    Report {
        Int id PK
        DateTime createdAt
        ReportStatus status
        String reporterId FK
        Int postId FK
    }
    Conversation {
        Int id PK
        DateTime createdAt
    }
    ConversationMember {
        Int conversationId PK, FK
        String userId PK, FK
        DateTime lastReadAt
    }
    Message {
        Int id PK
        Int conversationId FK
        String senderId FK
        DateTime createdAt
    }
    PostMedia {
        Int id PK
        Int postId FK
        DateTime createdAt
    }
    Community {
        Int id PK
        String slug UK
        DateTime createdAt
    }
    CommunityMember {
        Int id PK
        CommunityRole role
        DateTime createdAt
        String userId FK, UK "unique pair"
        Int communityId FK, UK "unique pair"
    }
    CommunityRule {
        Int id PK
        Int communityId FK
    }
    CommunityBannedUser {
        Int id PK
        DateTime createdAt
        String userId FK, UK "unique pair"
        Int communityId FK, UK "unique pair"
    }
    Comment {
        Int id PK
        DateTime createdAt
        DateTime deletedAt
        String userId FK
        Int postId FK
        Int parentCommentId FK
    }
    CommentMedia {
        Int id PK
        Int commentId FK
        DateTime createdAt
    }
    CommentLike {
        Int id PK
        DateTime createdAt
        String userId FK, UK "unique pair"
        Int commentId FK, UK "unique pair"
    }
    Mention {
        Int id PK
        DateTime createdAt
        Int postId FK
        Int commentId FK
        String userId FK
    }
    User ||--o{ Post : "userId"
    Post |o--o{ Post : "rePostId"
    Post |o--o{ Post : "parentPostId"
    Community |o--o{ Post : "communityId"
    Post ||--o{ PostTag : "postId"
    Hashtag ||--o{ PostTag : "hashtagId"
    User ||--o{ Like : "userId"
    Post ||--o{ Like : "postId"
    User ||--o{ SavedPosts : "userId"
    Post ||--o{ SavedPosts : "postId"
    User ||--o{ Notification : "recipientId"
    User ||--o{ Notification : "actorId"
    Post |o--o{ Notification : "postId"
    Comment |o--o{ Notification : "commentId"
    User ||--o{ Follow : "followerId"
    User ||--o{ Follow : "followingId"
    User ||--o{ Block : "blockerId"
    User ||--o{ Block : "blockedId"
    User ||--o{ Report : "reporterId"
    Post ||--o{ Report : "postId"
    Conversation ||--o{ ConversationMember : "conversationId"
    User ||--o{ ConversationMember : "userId"
    Conversation ||--o{ Message : "conversationId"
    User ||--o{ Message : "senderId"
    Post ||--o{ PostMedia : "postId"
    User ||--o{ CommunityMember : "userId"
    Community ||--o{ CommunityMember : "communityId"
    Community ||--o{ CommunityRule : "communityId"
    User ||--o{ CommunityBannedUser : "userId"
    Community ||--o{ CommunityBannedUser : "communityId"
    User ||--o{ Comment : "userId"
    Post ||--o{ Comment : "postId"
    Comment |o--o{ Comment : "parentCommentId"
    Comment ||--o{ CommentMedia : "commentId"
    User ||--o{ CommentLike : "userId"
    Comment ||--o{ CommentLike : "commentId"
    Post |o--o{ Mention : "postId"
    Comment |o--o{ Mention : "commentId"
    User ||--o{ Mention : "userId"
```

How to read a line: `User ||--o{ Post : "userId"` means one user has zero or more posts, and each post has exactly one user, through `Post.userId`. `|o` means the foreign key may be empty. For example, a post may have no community.

---

## Notes for the author

1. **Diagram tools** (decided 2026-11-19): the author draws the diagrams by hand: draw.io, or the Mermaid web editor with the scripts above. Each image goes in `images/` as PDF (or PNG at 300 dpi or more), with its editable source next to it (see `Report Architecture.md`, "Diagrams").
2. **Main flows only.** A diagram that does not support a sentence in the text is cut. The ERD is large; if it does not fit one page, put it on a landscape page or cut the field lists down to the keys.
3. **Check again after `p9-bug-quick-wins`.** That task may change routes and guards (for example B2, R1). If it does, update Figures 4.3, 4.5, 4.6 and 4.7.
4. **Other facts checked on 2026-11-19:**
   - The pre-thesis ERD (`docs/Pre-thesis/output/ERD_Breadit.dbml`) has drifted from the schema. It has 23 tables, and its `CommunityRule` has a `createdAt` that the schema does not have and lacks `description`. Use Figure 4.11, not the pre-thesis files.
   - Relations are named by the foreign key (`followerId`, `followingId`), not by the list names. In this schema `User.followers` means "the accounts this user follows" (CLAUDE.md).
   - The pre-thesis use case diagram (`docs/Pre-thesis/UseCaseDiagram1.png`) shows use cases that do not exist ("Config system", "Analytic and monitor system"). Figure 4.1 replaces it.
   - The pre-thesis sequence diagrams (`docs/Pre-thesis/uc*_sequence.mmd`) were not checked against today's code. Figures 4.5–4.8 replace the ones Chapter 4 needs.
