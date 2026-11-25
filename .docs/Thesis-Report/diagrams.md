# Diagrams of the thesis

This file lists every diagram of the thesis: its figure number, where it is used, the file name to save, the tool, the size, and the Mermaid script. Today there are 15: 11 in Chapter 4 and 4 in Appendix C (the fields of the database tables). The scripts are the same as in `drafts/04-system-analysis-and-design.md`. They were checked against the code (see "Checked" in each entry). The number in a title (Figure 4.1) is a working name: in the PDF, figure numbers run through the whole thesis and follow by themselves.

## How to make a diagram

1. Open the Mermaid web editor, <https://mermaid.live>, and paste the script. Or open draw.io, then Arrange → Insert → Advanced → Mermaid, and paste the script there. Then tidy the result by hand.
2. Export the image. From draw.io: File → Export as → PDF (a PDF stays sharp at every size). From mermaid.live: PNG or SVG. A PNG must be at least 1,850 px wide, which is 300 dpi at the 15.5 cm text width. Use a PDF whenever the tool can give one.
3. Save it in `.docs/Thesis-Report/images/` with the name of the entry: `images/fig4-<n>-<name>.pdf`, or `.png`.
4. Keep the source next to the image: the `.mmd` file is already there. If you redraw the figure in draw.io, also save `images/fig4-<n>-<name>.drawio`.
5. The five ERD scripts (Figure 4.11 and Appendix C) start with a `config` block: theme `neutral`, layout `elk` (a layout that packs the tables closer). mermaid.live reads it, so keep it when you paste.
6. Build: `latexmk -pdf main.tex` in `.docs/Thesis-Report/`. Do not edit the `.tex`. The macro `\thesisdiagram` (in `main.tex`) shows `images/<name>.pdf` if it exists, else `images/<name>.png`, else a box with the text "Figure to be drawn". The first time you add an image, plain `latexmk` says "up-to-date" and does not see it, so run `latexmk -g -pdf main.tex` once (`-g` forces a full build). Later changes of the same file are seen by themselves.

The macro shows the figure at the text width, and never taller than 80% of the page text height. Each figure keeps its caption and label in `chapters/system-analysis-and-design.tex`.

**One style for all figures.** Use one font in every diagram (a sans-serif font such as Arial or Helvetica, 10 pt in the final size) and few colours: black lines, white or light grey fill, and one accent colour (for example blue) for the new parts of the thesis, such as the ranking package. In mermaid.live, use the same theme for all sequence diagrams (the theme `neutral` is grey and prints well).

**Checked scripts.** On 2026-11-20 all 11 scripts were parsed and drawn with Mermaid 11.16.0, with no error. If mermaid.live shows a syntax error, the text was probably changed when you copied it: copy the script again from this file.

## Figure 4.1. Use case overview

- **Used in:** Chapter 4, Section 4.2 (Use cases), `\label{fig:design-usecase}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-1-usecase.pdf` (or `images/fig4-1-usecase.png`). Source: `images/fig4-1-usecase.mmd`.
- **Tool:** draw.io (stick-figure actors). Mermaid has no use case type, so the script is a flowchart.
- **Size:** Full text width (15.5 cm). It is wide: if the ovals get too small, put the actors above and below the "Breadit" box instead of left and right. Keep it on one page.
- **Checked against the code:** 2026-11-19.
- The actors stay outside the "Breadit" box. The use cases are the ovals inside it.
- In draw.io, draw the actors as stick figures. `«include»` is a dashed arrow from Sign up to Verify email. `is a` (the Community owner or moderator is a User) can be the UML generalization arrow (a closed, empty arrowhead).

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

## Figure 4.2. Sign up with email verification

- **Used in:** Chapter 4, Section 4.3 (Activity diagrams), `\label{fig:design-signup}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-2-signup.pdf` (or `images/fig4-2-signup.png`). Source: `images/fig4-2-signup.mmd`.
- **Tool:** draw.io (an activity diagram: round start and end, diamonds for decisions).
- **Size:** Full text width, portrait. About 14 nodes in a column: it needs 14 to 18 cm of height. If it is taller, put the "verify" part in a second column.
- **Checked against the code:** 2026-11-25 (changed: the limit of 5 code tries for each email, task `p10-security-fixes`).
- The two loops (400 or 409 back to the form, and "ask for a new code" back to the code step) must be easy to follow.

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
    A6 --> D5{"More than 5 tries for<br/>this email in 15 minutes?"}
    D5 -->|yes| R3["429: wait, then ask<br/>for a new code"]
    R3 --> D4
    D5 -->|no| D3{"Code right and<br/>not expired?"}
    D3 -->|no| D4{"Ask for a new code?"}
    D4 -->|yes| A7["POST /api/auth/verify/resend:<br/>a new code replaces the old one"]
    A7 --> A5
    D4 -->|no| A5
    D3 -->|yes| A8["Set emailVerified,<br/>delete the code"]
    A8 --> A9["Go to /sign-in?verified=1"]
    A9 --> E(((End)))
```

## Figure 4.3. Publish a post

- **Used in:** Chapter 4, Section 4.3 (Activity diagrams), `\label{fig:design-publish}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-3-publish-post.pdf` (or `images/fig4-3-publish-post.png`). Source: `images/fig4-3-publish-post.mmd`.
- **Tool:** draw.io (an activity diagram).
- **Size:** Full text width, portrait. It is the tallest activity diagram: up to 20 cm. The macro never makes an image taller than 80% of the page text height. If it is still too small to read, draw the checks in a first column and the saves and notifications in a second one.
- **Checked against the code:** 2026-11-20 (no change).

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

## Figure 4.4. Get one page of a feed

- **Used in:** Chapter 4, Section 4.3 (Activity diagrams), `\label{fig:design-feedpage}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-4-feed-page.pdf` (or `images/fig4-4-feed-page.png`). Source: `images/fig4-4-feed-page.mmd`.
- **Tool:** draw.io (an activity diagram).
- **Size:** Full text width, portrait, up to 20 cm tall. Draw the two branches (`algo` set, `algo` not set) side by side, and join them at "Store the page for 10 s".
- **Checked against the code:** 2026-11-19 (line numbers refreshed on 2026-11-20).
- The text says the figure is the place where the ranking plugs in. You can colour the box "FeedService.rank at time t" with the accent colour.
- Known small gap (draft note 6): "no blocked peers" is true for every mode except a profile feed. The text of the chapter says only "These queries leave out deleted posts and blocked users".

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

## Figure 4.5. Sign in, a signed-in request and sign out

- **Used in:** Chapter 4, Section 4.4 (Sequence diagrams), `\label{fig:design-session}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-5-auth-session.pdf` (or `images/fig4-5-auth-session.png`). Source: `images/fig4-5-auth-session.mmd`.
- **Tool:** Mermaid web editor (mermaid.live). A sequence diagram needs no redraw.
- **Size:** Full text width. Seven participants and about 20 messages: it is tall (up to 20 cm). Check that the text is still readable at 15.5 cm width (about 7 pt or more).
- **Checked against the code:** 2026-11-25 (changed: `readSession` reads the blacklist and the password version in one `MGET`; the token holds `pwv`; task `p10-security-fixes`).
- Changed on 2026-11-20: the step "verifyJwt" is now "readSession: verifyJwt", because `JwtAuthGuard` calls `readSession` (`auth/session.ts`).

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
        AS->>AS: signJwt: HS256, a new jti, pwv = passwordVersion, 30 days
        AS-->>B: 200 user, Set-Cookie breadit_session (httpOnly)
    end
    Note over B,R: Every later request sends the cookie
    B->>G: GET /api/... with the cookie
    G->>G: readSession: verifyJwt
    G->>R: MGET auth:blacklist:jti, auth:pwv:userId
    R-->>G: not blacklisted, version equals the pwv of the token
    G->>G: req.user = id, username, emailVerified, role, banned
    U->>B: sign out
    B->>AC: POST /api/auth/logout with the cookie
    AC->>AS: logout(token)
    AS->>R: SET auth:blacklist:jti until the token expires
    AS-->>B: 200, clear the cookie
    B->>G: a request with the old token
    G->>R: MGET auth:blacklist:jti, auth:pwv:userId
    R-->>G: blacklisted
    G-->>B: 401
    Note over B,R: After a password reset, the version is one higher, so every older token also gets 401
```

## Figure 4.6. Like a post, with the notification saved and pushed

- **Used in:** Chapter 4, Section 4.4 (Sequence diagrams), `\label{fig:design-like}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-6-like-notification.pdf` (or `images/fig4-6-like-notification.png`). Source: `images/fig4-6-like-notification.mmd`.
- **Tool:** Mermaid web editor (mermaid.live).
- **Size:** Full text width. Seven participants with long names. Up to 20 cm tall.
- **Checked against the code:** 2026-11-20 (changed: `canSeePost`).
- Changed on 2026-11-20: a new step `canSeePost`, and the 404 branch also covers a post that waits for approval (`posts/visibility.ts`, finding R2).

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
    S->>S: canSeePost: a post that waits for approval is open<br/>only to its author, and to the owner or a moderator of its community
    alt no such post, or Alice may not see it
        S-->>A: 404 Post not found
    else found and visible
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

## Figure 4.7. A direct message in real time

- **Used in:** Chapter 4, Section 4.4 (Sequence diagrams), `\label{fig:design-dm}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-7-direct-message.pdf` (or `images/fig4-7-direct-message.png`). Source: `images/fig4-7-direct-message.mmd`.
- **Tool:** Mermaid web editor (mermaid.live).
- **Size:** Full text width, up to 18 cm tall.
- **Checked against the code:** 2026-11-25 (changed: the socket uses `readSession`, task `p10-security-fixes`).

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
    GW->>GW: readSession: the cookie, the logout blacklist and the password version
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

## Figure 4.8. The For You feed with algo=social

- **Used in:** Chapter 4, Section 4.4 (Sequence diagrams), `\label{fig:design-social}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-8-foryou-social.pdf` (or `images/fig4-8-foryou-social.png`). Source: `images/fig4-8-foryou-social.mmd`.
- **Tool:** Mermaid web editor (mermaid.live).
- **Size:** Full text width, up to 18 cm tall. Some messages are long: if they are cut, add line breaks with `<br/>`.
- **Checked against the code:** 2026-11-19 (line numbers refreshed on 2026-11-20).
- The same diagram is in Guidance Manual 08, section 4. If you change this one, change that one too.

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

## Figure 4.9. The components of the platform

- **Used in:** Chapter 4, Section 4.5 (Architecture and modules), `\label{fig:design-components}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-9-components.pdf` (or `images/fig4-9-components.png`). Source: `images/fig4-9-components.mmd`.
- **Tool:** draw.io (an architecture diagram: boxes in groups, cylinders for data stores).
- **Size:** Full text width, landscape-like (about 15.5 by 10 cm). The script is a left-to-right flowchart. Browser on the left, the three data services on the right.
- **Checked against the code:** 2026-11-19.
- The same parts are in Guidance Manual 12, section 1.

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

## Figure 4.10. The boundary of the ranking package

- **Used in:** Chapter 4, Section 4.5 (Architecture and modules), `\label{fig:design-boundary}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-10-ranking-boundary.pdf` (or `images/fig4-10-ranking-boundary.png`). Source: `images/fig4-10-ranking-boundary.mmd`.
- **Tool:** draw.io (an architecture diagram).
- **Size:** Full text width, about 15.5 by 8 cm.
- **Checked against the code:** 2026-11-19.
- This is the figure of the main design rule of the thesis. Use the accent colour for the `@breadit/ranking` box, and a dashed line for `eval/`.
- The same diagram is in Guidance Manual 08, section 1.

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

## Figure 4.11. The ERD of the database

- **Used in:** Chapter 4, Section 4.6 (Database design), `\label{fig:design-erd}` in `chapters/system-analysis-and-design.tex`.
- **File to save:** `images/fig4-11-erd.pdf` (or `images/fig4-11-erd.png`). Source: `images/fig4-11-erd.mmd`.
- **Tool:** mermaid.live (the script sets layout `elk` and direction `LR`, left to right).
- **Size:** Full text width. 23 tables and 39 lines, names only, no fields. Measured on 2026-11-25 with Mermaid 11.12.0: 1,339 × 1,748 px, so the text is about 5 pt at the page size. With the fields, the same ERD was 2,636 px wide (text about 1.5 pt): this is why the fields moved to Appendix C.
- **Checked against the code:** 2026-11-25 (from `schema.prisma`; new column `User.passwordVersion`, task `p10-security-fixes`).
- The caption is already in the `.tex`: 23 of the 25 models; `Account` and `Session` are left out, because no code reads them. `VerificationToken` has no foreign key, so it stands alone.
- How to read a line: `User ||--o{ Post : "userId"` means one user has zero or more posts, and each post has exactly one user, through `Post.userId`. `|o` means the foreign key may be empty.

```mermaid
---
config:
  theme: neutral
  layout: elk
---
erDiagram
    direction LR
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
    VerificationToken
```

## Appendix C. The fields of the database tables

Four figures, one per group of tables. Each table shows its keys (PK, FK, UK), its enum and Boolean fields and its `DateTime` fields except `updatedAt`. Each foreign key line is drawn once, in the figure of the table that holds the key; a table of another group that the line reaches is drawn as a box with its name only. Together the four figures hold the 23 tables and the 39 lines of Figure 4.11. Measured on 2026-11-25 with Mermaid 11.12.0, the text is 6 to 8 pt at the page size.

## Figure C.1. The tables of users, the social graph and messages

- **Used in:** Appendix C, `\label{fig:app-erd-users}` in `chapters/appendix.tex`.
- **File to save:** `images/figC-1-erd-users.pdf` (or `images/figC-1-erd-users.png`). Source: `images/figC-1-erd-users.mmd`.
- **Tool:** mermaid.live (the script sets theme `neutral` and layout `elk`).
- **Content:** users, the social graph and messages (8 tables, 12 lines; `Post` and `Comment` drawn as names only).
- **Checked against the code:** 2026-11-25 (from `schema.prisma`).

```mermaid
---
config:
  theme: neutral
  layout: elk
---
erDiagram
    direction LR
    User {
        String id PK
        String email UK
        String username UK
        DateTime emailVerified
        Role role
        Boolean banned
        Int passwordVersion
        DateTime createdAt
    }
    VerificationToken {
        String identifier UK "unique pair"
        String token UK "unique pair"
        DateTime expires
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
    User ||--o{ Notification : "recipientId"
    User ||--o{ Notification : "actorId"
    Post |o--o{ Notification : "postId"
    Comment |o--o{ Notification : "commentId"
    User ||--o{ Follow : "followerId"
    User ||--o{ Follow : "followingId"
    User ||--o{ Block : "blockerId"
    User ||--o{ Block : "blockedId"
    Conversation ||--o{ ConversationMember : "conversationId"
    User ||--o{ ConversationMember : "userId"
    Conversation ||--o{ Message : "conversationId"
    User ||--o{ Message : "senderId"
```

## Figure C.2. The tables of posts

- **Used in:** Appendix C, `\label{fig:app-erd-posts}` in `chapters/appendix.tex`.
- **File to save:** `images/figC-2-erd-posts.pdf` (or `images/figC-2-erd-posts.png`). Source: `images/figC-2-erd-posts.mmd`.
- **Tool:** mermaid.live (the script sets theme `neutral` and layout `elk`).
- **Content:** posts (7 tables, 13 lines; `User` and `Community` drawn as names only).
- **Checked against the code:** 2026-11-25 (from `schema.prisma`).

```mermaid
---
config:
  theme: neutral
  layout: elk
---
erDiagram
    direction LR
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
    PostMedia {
        Int id PK
        Int postId FK
        DateTime createdAt
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
    Report {
        Int id PK
        DateTime createdAt
        ReportStatus status
        String reporterId FK
        Int postId FK
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
    User ||--o{ Report : "reporterId"
    Post ||--o{ Report : "postId"
    Post ||--o{ PostMedia : "postId"
```

## Figure C.3. The tables of comments

- **Used in:** Appendix C, `\label{fig:app-erd-comments}` in `chapters/appendix.tex`.
- **File to save:** `images/figC-3-erd-comments.pdf` (or `images/figC-3-erd-comments.png`). Source: `images/figC-3-erd-comments.mmd`.
- **Tool:** mermaid.live (the script sets theme `neutral` and layout `elk`).
- **Content:** comments (4 tables, 9 lines; `User` and `Post` drawn as names only).
- **Checked against the code:** 2026-11-25 (from `schema.prisma`).

```mermaid
---
config:
  theme: neutral
  layout: elk
---
erDiagram
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

## Figure C.4. The tables of communities

- **Used in:** Appendix C, `\label{fig:app-erd-communities}` in `chapters/appendix.tex`.
- **File to save:** `images/figC-4-erd-communities.pdf` (or `images/figC-4-erd-communities.png`). Source: `images/figC-4-erd-communities.mmd`.
- **Tool:** mermaid.live (the script sets theme `neutral` and layout `elk`).
- **Content:** communities (4 tables, 5 lines; `User` drawn as a name only).
- **Checked against the code:** 2026-11-25 (from `schema.prisma`).

```mermaid
---
config:
  theme: neutral
  layout: elk
---
erDiagram
    direction LR
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
    CommunityBannedUser {
        Int id PK
        DateTime createdAt
        String userId FK, UK "unique pair"
        Int communityId FK, UK "unique pair"
    }
    CommunityRule {
        Int id PK
        Int communityId FK
    }
    User ||--o{ CommunityMember : "userId"
    Community ||--o{ CommunityMember : "communityId"
    Community ||--o{ CommunityRule : "communityId"
    User ||--o{ CommunityBannedUser : "userId"
    Community ||--o{ CommunityBannedUser : "communityId"
```
