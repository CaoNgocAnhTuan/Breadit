# Class Diagram — Breadit Backend

This document provides a precise, code-accurate structural reference for the NestJS backend in `apps/backend/src/`. Every class, its methods, injected dependencies, and the guard chain on each endpoint are documented from the actual source files.

---

## 1. Module Dependency Graph

NestJS organises code into **Modules**. The root `AppModule` imports every feature module. `PrismaModule` and `RedisModule` are `global: true` so they are available everywhere without explicit imports.

```
AppModule
├── ConfigModule (global, .env loading)
├── ThrottlerModule (global guard — 120 req / 60 s, Redis-backed)
├── PrismaModule (global)        ← PrismaService
├── RedisModule (global)         ← RedisService
├── HealthModule                 ← HealthController
├── AuthModule                   ← AuthController, AuthService
├── UploadsModule                ← UploadsController, UploadsService
├── PostsModule                  ← PostsController, PostsService
├── InteractionsModule           ← InteractionsController, InteractionsService
├── UsersModule                  ← UsersController, UsersService
├── HashtagsModule               ← HashtagsController, HashtagsService
├── SearchModule                 ← SearchController, SearchService
├── NotificationsModule          ← NotificationsController, NotificationsService, NotificationsGateway
├── MessagesModule               ← MessagesController, MessagesService
├── CommunitiesModule            ← CommunitiesController, CommunitiesService
└── AdminModule                  ← AdminController, AdminService
```

---

## 2. Guard Reference

Guards run **before** the route handler. Multiple guards on a route run left-to-right; the first failure aborts the chain.

| Guard | Class | Behaviour |
|-------|-------|-----------|
| `JwtAuthGuard` | `CanActivate` | Reads `breadit_session` cookie → `verifyJwt()` → attaches `req.user`. Throws 401 if missing or invalid. |
| `OptionalJwtAuthGuard` | `CanActivate` | Same JWT check but **never** throws — leaves `req.user` undefined for guests. Always returns `true`. |
| `EmailVerifiedGuard` | `CanActivate` | Checks `req.user.emailVerified` is not null. Throws 403 if unverified. |
| `BannedUserGuard` | `CanActivate` | Checks `req.user.banned`. Throws 403 if `true`. |
| `RolesGuard` | `CanActivate` | Reads `@Roles()` metadata via `Reflector`. Checks `req.user.role`. Throws 403 if role not in the required list. |
| `ThrottlerGuard` | Global (AppModule) | 120 requests / 60 s per IP, stored in Redis. Overridable per-route via `@Throttle()`. |

---

## 3. Class Diagrams

### 3.1 Infrastructure Layer

```mermaid
classDiagram
    class PrismaService {
        <<Service, global>>
        +$connect() Promise~void~
        +$disconnect() Promise~void~
        +$transaction(operations) Promise~any~
        +user PrismaUserDelegate
        +post PrismaPostDelegate
        +like PrismaLikeDelegate
        +savedPosts PrismaSavedPostsDelegate
        +follow PrismaFollowDelegate
        +block PrismaBlockDelegate
        +hashtag PrismaHashtagDelegate
        +postTag PrismaPostTagDelegate
        +notification PrismaNotificationDelegate
        +report PrismaReportDelegate
        +conversation PrismaConversationDelegate
        +conversationMember PrismaConversationMemberDelegate
        +message PrismaMessageDelegate
        +community PrismaCommunityDelegate
        +communityMember PrismaCommunityMemberDelegate
        +communityRule PrismaCommunityRuleDelegate
        +communityBannedUser PrismaCommunityBannedUserDelegate
        +verificationToken PrismaVerificationTokenDelegate
    }

    class RedisService {
        <<Service, global>>
        -redisUrl: string
        +quit() Promise~void~
    }

    class AllExceptionsFilter {
        <<ExceptionFilter, global>>
        -logger: Logger
        +catch(exception, host) void
    }

    PrismaService --|> PrismaClient : extends
    RedisService --|> IORedis : extends
```

### 3.2 Auth Module

```mermaid
classDiagram
    class AuthController {
        <<Controller /api/auth>>
        -auth: AuthService
        +register(dto: RegisterDto) Promise
        +login(dto: LoginDto, reply) Promise
        +logout(reply) object
        +me(req) Promise
        +verifyEmail(dto: VerifyDto) Promise
        +resendVerification(dto: ResendVerifyDto) Promise
        +forgotPassword(dto: ForgotPasswordDto) Promise
        +resetPassword(dto: ResetPasswordDto) Promise
    }

    class AuthService {
        <<Service>>
        -prisma: PrismaService
        -createTransporter() Transporter
        -sendMail(to, subject, html) Promise~void~
        -generate6DigitCode() string
        -createVerificationCode(email) Promise~string~
        -consumeVerificationCode(email, code) Promise
        -createPasswordResetToken(email) Promise~string~
        -consumePasswordResetToken(token) Promise
        -sendVerificationEmail(to, code) Promise~void~
        -sendPasswordResetEmail(to, token) Promise~void~
        +register(dto) Promise
        +login(dto, reply) Promise
        +logout(reply) object
        +me(userId) Promise
        +verifyEmail(email, code) Promise
        +resendVerificationCode(email) Promise
        +forgotPassword(email) Promise
        +resetPassword(token, password) Promise
    }

    class JwtAuthGuard {
        <<Guard>>
        +canActivate(ctx) Promise~boolean~
    }

    class OptionalJwtAuthGuard {
        <<Guard>>
        +canActivate(ctx) Promise~boolean~
    }

    class EmailVerifiedGuard {
        <<Guard>>
        +canActivate(ctx) boolean
    }

    class BannedUserGuard {
        <<Guard>>
        +canActivate(ctx) boolean
    }

    class RolesGuard {
        <<Guard>>
        -reflector: Reflector
        +canActivate(ctx) boolean
    }

    class RegisterDto {
        <<DTO>>
        +username: string
        +email: string
        +password: string
    }

    class LoginDto {
        <<DTO>>
        +email: string
        +password: string
    }

    class VerifyDto {
        <<DTO>>
        +email: string
        +code: string
    }

    class ResendVerifyDto {
        <<DTO>>
        +email: string
    }

    class ForgotPasswordDto {
        <<DTO>>
        +email: string
    }

    class ResetPasswordDto {
        <<DTO>>
        +token: string
        +password: string
    }

    AuthController --> AuthService : injects
    AuthService --> PrismaService : injects
    AuthController ..> JwtAuthGuard : uses on GET /me
    JwtAuthGuard ..> AuthService : calls verifyJwt()
    OptionalJwtAuthGuard ..> AuthService : calls verifyJwt()
```

**Endpoint guard chains — AuthController:**

| Method | Path | Guards |
|--------|------|--------|
| POST | `/api/auth/register` | Throttle (10/60s) |
| POST | `/api/auth/login` | Throttle (10/60s) |
| POST | `/api/auth/logout` | — |
| GET | `/api/auth/me` | `JwtAuthGuard` |
| POST | `/api/auth/verify` | Throttle (10/60s) |
| POST | `/api/auth/verify/resend` | Throttle (5/60s) |
| POST | `/api/auth/forgot-password` | Throttle (5/60s) |
| POST | `/api/auth/reset-password` | Throttle (5/60s) |

---

### 3.3 Posts Module

```mermaid
classDiagram
    class PostsController {
        <<Controller /api/posts>>
        -postsService: PostsService
        +findAll(cursor, user, feed, communityId, req) Promise
        +findOne(id, req) Promise
        +create(req) Promise
        +createComment(id, req) Promise
        +createReport(postId, body, req) Promise
        +remove(id, req) Promise
    }

    class PostsService {
        <<Service>>
        -prisma: PrismaService
        -uploadsService: UploadsService
        -notificationsService: NotificationsService
        -postInclude(userId?) object
        +findAll(cursor, userParam?, userId?, feed?, communityId?) Promise
        +findOne(postId, userId?) Promise
        +create(userId, body, files) Promise
        +createReport(reporterId, postId, reason) Promise
        +remove(postId, userId) Promise
    }

    PostsController --> PostsService : injects
    PostsService --> PrismaService : injects
    PostsService --> UploadsService : injects
    PostsService --> NotificationsService : injects
```

**Endpoint guard chains — PostsController:**

| Method | Path | Guards |
|--------|------|--------|
| GET | `/api/posts` | `OptionalJwtAuthGuard` |
| GET | `/api/posts/:id` | `OptionalJwtAuthGuard` |
| POST | `/api/posts` | `JwtAuthGuard` → `EmailVerifiedGuard` |
| POST | `/api/posts/:id/comments` | `JwtAuthGuard` → `EmailVerifiedGuard` |
| POST | `/api/posts/:id/report` | `JwtAuthGuard` → `BannedUserGuard` |
| DELETE | `/api/posts/:id` | `JwtAuthGuard` → `BannedUserGuard` |

**Key business logic in PostsService.create():**
- Checks community ban and membership before creating post
- Uploads each file via `UploadsService.saveFile()`
- Extracts `#hashtags` → upserts `Hashtag` + `PostTag` records
- Extracts `@mentions` → fires `MENTION` notification (fire-and-forget)
- If reply → fires `REPLY` notification (fire-and-forget)
- If community post by staff → fires `COMMUNITY_NEW_POST` to all members
- If community post by member → fires `COMMUNITY_POST` to mods only; `isApproved: false`

---

### 3.4 Interactions Module

```mermaid
classDiagram
    class InteractionsController {
        <<Controller /api/posts>>
        -interactionsService: InteractionsService
        +toggleLike(id, req) Promise
        +toggleSave(id, req) Promise
        +toggleRepost(id, body, req) Promise
    }

    class InteractionsService {
        <<Service>>
        -prisma: PrismaService
        -notificationsService: NotificationsService
        +toggleLike(userId, postId) Promise
        +toggleSave(userId, postId) Promise
        +toggleRepost(userId, postId, desc?) Promise
    }

    InteractionsController --> InteractionsService : injects
    InteractionsService --> PrismaService : injects
    InteractionsService --> NotificationsService : injects
```

**Endpoint guard chains — InteractionsController:**

| Method | Path | Guards |
|--------|------|--------|
| POST | `/api/posts/:id/like` | `JwtAuthGuard` → `BannedUserGuard` → `EmailVerifiedGuard` |
| POST | `/api/posts/:id/save` | `JwtAuthGuard` → `BannedUserGuard` → `EmailVerifiedGuard` |
| POST | `/api/posts/:id/repost` | `JwtAuthGuard` → `BannedUserGuard` → `EmailVerifiedGuard` |

**toggleRepost logic:** If `desc` is provided → always creates a new quoted repost. If no `desc` → toggle: deletes soft-deleted repost if existing, else creates a plain repost. Fires `REPOST` notification (fire-and-forget) on new reposts.

---

### 3.5 Users Module

```mermaid
classDiagram
    class UsersController {
        <<Controller /api/users>>
        -usersService: UsersService
        +toggleBlock(targetId, req) Promise
        +toggleFollow(targetId, body, req) Promise
        +updateProfile(req, dto) Promise
        +getRecommendations(req) Promise
        +getConnectUsers(req, cursor) Promise
        +getProfilePosts(username, tab, cursor, req) Promise
        +getFollowers(username, cursor) Promise
        +getFollowing(username, cursor) Promise
        +getSavedPosts(req, cursor) Promise
        +findByUsername(username, req) Promise
    }

    class UsersService {
        <<Service>>
        -prisma: PrismaService
        -notificationsService: NotificationsService
        -postInclude(userId?) object
        +findByUsername(username, currentUserId?) Promise
        +getPostsByTab(username, tab, cursor, currentUserId?) Promise
        +getFollowers(username, cursor) Promise
        +getFollowing(username, cursor) Promise
        +toggleFollow(followerId, followingId, notify?) Promise
        +toggleBlock(blockerId, blockedId) Promise
        +updateProfile(userId, dto) Promise
        +getSavedPosts(userId, cursor) Promise
        +getRecommendations(userId) Promise
        +getConnectUsers(userId, cursor) Promise
    }

    class UpdateUserDto {
        <<DTO>>
        +displayName?: string
        +bio?: string
        +location?: string
        +job?: string
        +website?: string
        +img?: string
        +cover?: string
    }

    UsersController --> UsersService : injects
    UsersService --> PrismaService : injects
    UsersService --> NotificationsService : injects
```

**Endpoint guard chains — UsersController:**

| Method | Path | Guards |
|--------|------|--------|
| POST | `/api/users/:id/block` | `JwtAuthGuard` → `BannedUserGuard` |
| POST | `/api/users/:id/follow` | `JwtAuthGuard` → `BannedUserGuard` |
| PATCH | `/api/users/me` | `JwtAuthGuard` → `BannedUserGuard` |
| GET | `/api/users/recommendations` | `JwtAuthGuard` |
| GET | `/api/users/connect` | `JwtAuthGuard` |
| GET | `/api/users/:username/posts` | `OptionalJwtAuthGuard` |
| GET | `/api/users/:username/followers` | — |
| GET | `/api/users/:username/following` | — |
| GET | `/api/users/me/saved` | `JwtAuthGuard` |
| GET | `/api/users/:username` | `OptionalJwtAuthGuard` |

**toggleBlock side-effect:** Also deletes any existing Follow rows in both directions between the two users (atomic with `Promise.all`).

**getRecommendations algorithm:** Friends-of-friends first (users followed by someone the current user follows, ordered by follower count). Falls back to globally popular users if < 3 results.

---

### 3.6 Notifications Module

```mermaid
classDiagram
    class NotificationsController {
        <<Controller /api/notifications>>
        -notificationsService: NotificationsService
        +findAll(req, cursor, unread) Promise
        +markAllRead(req) Promise
        +markRead(id, req) Promise
    }

    class NotificationsService {
        <<Service>>
        -prisma: PrismaService
        -gateway: NotificationsGateway
        +emit(type, actorId, recipientId, postId?) Promise
        +findAll(userId, cursor, unread) Promise
        +markRead(userId, notifId) Promise
        +markAllRead(userId) Promise
    }

    class NotificationsGateway {
        <<WebSocketGateway>>
        +server: Server
        +afterInit(server) void
        +handleConnection(socket) Promise~void~
        +handleNewUser(socket, username) void
        +handleSendNotification(payload) void
        +handleJoinConversation(socket, conversationId) void
        +handleLeaveConversation(socket, conversationId) void
        +handleStartTyping(socket, payload) void
        +handleStopTyping(socket, payload) void
    }

    NotificationsController --> NotificationsService : injects
    NotificationsService --> PrismaService : injects
    NotificationsService --> NotificationsGateway : injects
```

**Endpoint guard chains — NotificationsController:**

| Method | Path | Guards |
|--------|------|--------|
| GET | `/api/notifications` | `JwtAuthGuard` |
| PATCH | `/api/notifications/read-all` | `JwtAuthGuard` |
| PATCH | `/api/notifications/:id/read` | `JwtAuthGuard` |

**NotificationsGateway WebSocket events:**

| Client emits | Server handler | What it does |
|--------------|---------------|--------------|
| `newUser` | `handleNewUser` | `socket.join(username)` — each user gets a private room named after their username |
| `sendNotification` | `handleSendNotification` | Emits `getNotification` to the named room (client-side convenience; service also calls `emit()` directly) |
| `joinConversation` | `handleJoinConversation` | `socket.join("conversation:<id>")` |
| `leaveConversation` | `handleLeaveConversation` | `socket.leave("conversation:<id>")` |
| `startTyping` | `handleStartTyping` | Broadcasts `userTyping` to conversation room (fire-and-forget, no DB) |
| `stopTyping` | `handleStopTyping` | Broadcasts `userStopTyping` to conversation room (fire-and-forget) |

| Server emits | Triggered by | Recipient |
|--------------|-------------|-----------|
| `getNotification` | `NotificationsService.emit()` or `handleSendNotification` | User's private username room |
| `newMessage` | `MessagesService.sendMessage()` | Recipient's private username room |
| `messageRead` | `MessagesService.markRead()` | Other member's private username room |
| `userTyping` | `handleStartTyping` | Conversation room (excluding sender) |
| `userStopTyping` | `handleStopTyping` | Conversation room (excluding sender) |

**NotificationsService.emit() guards:** Silently returns if `actorId === recipientId` — no self-notifications.

**Redis adapter:** `afterInit()` creates two separate `ioredis` clients (pub + sub) and attaches them via `@socket.io/redis-adapter`, enabling WebSocket pub/sub across multiple backend instances.

---

### 3.7 Messages Module

```mermaid
classDiagram
    class MessagesController {
        <<Controller /api/conversations>>
        -messagesService: MessagesService
        +getConversations(req, cursor?) Promise
        +getUnreadCount(req) Promise
        +findOrCreate(req, dto) Promise
        +getConversationById(req, id) Promise
        +getMessages(req, id, cursor?) Promise
        +sendMessage(req, id, dto) Promise
        +markRead(req, id) Promise
    }

    class MessagesService {
        <<Service>>
        -prisma: PrismaService
        -gateway: NotificationsGateway
        -assertMember(conversationId, userId) Promise
        +getConversations(userId, cursor?) Promise
        +findOrCreateConversation(userId, dto) Promise
        +getConversationById(conversationId, userId) Promise
        +getMessages(conversationId, userId, cursor?) Promise
        +sendMessage(conversationId, senderId, dto) Promise
        +markRead(conversationId, userId) Promise
        +getUnreadCount(userId) Promise
    }

    class CreateConversationDto {
        <<DTO>>
        +targetUserId: string
    }

    class CreateMessageDto {
        <<DTO>>
        +body?: string
        +mediaUrl?: string
    }

    MessagesController --> MessagesService : injects
    MessagesService --> PrismaService : injects
    MessagesService --> NotificationsGateway : injects
```

**Endpoint guard chains — MessagesController** (all routes also have controller-level `JwtAuthGuard`):

| Method | Path | Additional Guards |
|--------|------|------------------|
| GET | `/api/conversations` | — |
| GET | `/api/conversations/unread-count` | — |
| POST | `/api/conversations` | `EmailVerifiedGuard` |
| GET | `/api/conversations/:id` | — |
| GET | `/api/conversations/:id/messages` | — |
| POST | `/api/conversations/:id/messages` | `EmailVerifiedGuard` |
| PATCH | `/api/conversations/:id/read` | — |

**sendMessage side-effects:** Uses `prisma.$transaction` to atomically create the `Message` and bump `Conversation.updatedAt`. Then emits `newMessage` via Socket.IO to the recipient's username room. **`markRead`** updates `ConversationMember.lastReadAt` then emits `messageRead` to the other member's room.

---

### 3.8 Communities Module

```mermaid
classDiagram
    class CommunitiesController {
        <<Controller /api/communities>>
        -communitiesService: CommunitiesService
        +create(req, dto) Promise
        +findAll(q?, req) Promise
        +findBySlug(slug, req) Promise
        +join(req, id) Promise
        +update(req, id, dto) Promise
        +addRule(req, id, dto) Promise
        +removeRule(req, id, ruleId) Promise
        +banUser(req, id, targetUserId, reason?) Promise
        +getBannedUsers(req, id) Promise
        +unbanUser(req, id, targetUserId) Promise
        +promoteMember(req, id, targetUserId, role) Promise
        +deleteCommunity(req, id) Promise
        +transferOwnership(req, id, newOwnerId) Promise
        +getPendingPosts(req, id) Promise
        +moderatePost(req, id, postId, action) Promise
    }

    class CommunitiesService {
        <<Service>>
        -prisma: PrismaService
        -notificationsService: NotificationsService
        +create(userId, dto) Promise
        +findAll(q?, userId?) Promise
        +findBySlug(slug, userId?) Promise
        +join(userId, communityId) Promise
        +update(userId, communityId, dto) Promise
        +addRule(userId, communityId, title, description?) Promise
        +removeRule(userId, communityId, ruleId) Promise
        +banUser(userId, communityId, targetUserId, reason?) Promise
        +getBannedUsers(userId, communityId) Promise
        +unbanUser(userId, communityId, targetUserId) Promise
        +promoteMember(userId, communityId, targetUserId, role) Promise
        +deleteCommunity(userId, communityId) Promise
        +transferOwnership(userId, communityId, newOwnerId) Promise
        +getPendingPosts(userId, communityId) Promise
        +moderatePost(userId, communityId, postId, action) Promise
    }

    class CreateCommunityDto {
        <<DTO>>
        +name: string
        +slug: string
        +description?: string
    }

    class UpdateCommunityDto {
        <<DTO>>
        +name?: string
        +description?: string
    }

    class AddRuleDto {
        <<DTO>>
        +title: string
        +description?: string
    }

    CommunitiesController --> CommunitiesService : injects
    CommunitiesService --> PrismaService : injects
    CommunitiesService --> NotificationsService : injects
```

**Endpoint guard chains — CommunitiesController:**

| Method | Path | Guards |
|--------|------|--------|
| POST | `/api/communities` | `JwtAuthGuard` → `EmailVerifiedGuard` |
| GET | `/api/communities` | `OptionalJwtAuthGuard` |
| GET | `/api/communities/:slug` | `OptionalJwtAuthGuard` |
| POST | `/api/communities/:id/join` | `JwtAuthGuard` → `BannedUserGuard` |
| PATCH | `/api/communities/:id` | `JwtAuthGuard` → `BannedUserGuard` |
| POST | `/api/communities/:id/rules` | `JwtAuthGuard` → `BannedUserGuard` |
| DELETE | `/api/communities/:id/rules/:ruleId` | `JwtAuthGuard` → `BannedUserGuard` |
| POST | `/api/communities/:id/ban/:targetUserId` | `JwtAuthGuard` → `BannedUserGuard` |
| GET | `/api/communities/:id/bans` | `JwtAuthGuard` |
| DELETE | `/api/communities/:id/ban/:targetUserId` | `JwtAuthGuard` → `BannedUserGuard` |
| POST | `/api/communities/:id/promote/:targetUserId` | `JwtAuthGuard` → `BannedUserGuard` |
| DELETE | `/api/communities/:id` | `JwtAuthGuard` → `BannedUserGuard` |
| POST | `/api/communities/:id/transfer/:newOwnerId` | `JwtAuthGuard` → `BannedUserGuard` |
| GET | `/api/communities/:id/posts/pending` | `JwtAuthGuard` |
| POST | `/api/communities/:id/posts/:postId/moderate` | `JwtAuthGuard` → `BannedUserGuard` |

**Key service behaviours:**
- `deleteCommunity` uses `prisma.$transaction` — atomically soft-deletes all posts, deletes bans/rules/members, then deletes the community. Only OWNER can trigger.
- `banUser` uses `prisma.$transaction` — upserts ban record and removes the member record in one shot.
- `transferOwnership` uses `prisma.$transaction` — demotes current owner to MOD and promotes new owner atomically.
- `promoteMember` blocks promoting to OWNER (must use `transferOwnership` instead).
- `moderatePost(APPROVE)` sets `isApproved: true` then fans out `COMMUNITY_NEW_POST` to all members (fire-and-forget).
- `moderatePost(REMOVE)` soft-deletes the post.

---

### 3.9 Admin Module

```mermaid
classDiagram
    class AdminController {
        <<Controller /api/admin>>
        -adminService: AdminService
        +getUsers(cursor, q?) Promise
        +banUser(id) Promise
        +unbanUser(id) Promise
        +getReports(cursor) Promise
        +dismissReport(id) Promise
        +deleteReportedPost(id) Promise
    }

    class AdminService {
        <<Service>>
        -prisma: PrismaService
        +getUsers(cursor, q?) Promise
        +setBanStatus(id, banned) Promise
        +getReports(cursor) Promise
        +dismissReport(id) Promise
        +deleteReportedPost(id) Promise
    }

    AdminController --> AdminService : injects
    AdminService --> PrismaService : injects
```

**Endpoint guard chains — AdminController** (all routes have controller-level guards):

| Method | Path | Guards |
|--------|------|--------|
| GET | `/api/admin/users` | `JwtAuthGuard` → `RolesGuard` (`ADMIN`) |
| POST | `/api/admin/users/:id/ban` | `JwtAuthGuard` → `RolesGuard` (`ADMIN`) |
| POST | `/api/admin/users/:id/unban` | `JwtAuthGuard` → `RolesGuard` (`ADMIN`) |
| GET | `/api/admin/reports` | `JwtAuthGuard` → `RolesGuard` (`ADMIN`) |
| POST | `/api/admin/reports/:id/dismiss` | `JwtAuthGuard` → `RolesGuard` (`ADMIN`) |
| DELETE | `/api/admin/reports/:id/delete-post` | `JwtAuthGuard` → `RolesGuard` (`ADMIN`) |

---

### 3.10 Search, Hashtags & Uploads Modules

```mermaid
classDiagram
    class SearchController {
        <<Controller /api/search>>
        -searchService: SearchService
        +search(q, req) Promise
    }

    class SearchService {
        <<Service>>
        -prisma: PrismaService
        +search(q, userId?) Promise
    }

    class HashtagsController {
        <<Controller /api/hashtags>>
        -hashtagsService: HashtagsService
        +getPostsByTag(tag, cursor, req) Promise
    }

    class HashtagsService {
        <<Service>>
        -prisma: PrismaService
        -postInclude(userId?) object
        +getPostsByTag(tag, cursor, userId?) Promise
    }

    class UploadsController {
        <<Controller /api/uploads>>
        -uploadsService: UploadsService
        +upload(req) Promise
    }

    class UploadsService {
        <<Service>>
        -uploadDir: string
        -useCloudinary: boolean
        +saveFile(file, imgType?) Promise~string~
        -saveToCloudinary(file, imgType?) Promise~string~
        -saveToLocalDisk(file, imgType?) Promise~string~
        +isVideo(file) boolean
    }

    class HealthController {
        <<Controller /api/health>>
        +check() object
    }

    SearchController --> SearchService : injects
    SearchService --> PrismaService : injects
    HashtagsController --> HashtagsService : injects
    HashtagsService --> PrismaService : injects
    UploadsController --> UploadsService : injects
```

**Endpoint guard chains:**

| Module | Method | Path | Guards |
|--------|--------|------|--------|
| Search | GET | `/api/search` | `OptionalJwtAuthGuard` |
| Hashtags | GET | `/api/hashtags/:tag/posts` | `OptionalJwtAuthGuard` |
| Uploads | POST | `/api/uploads` | `JwtAuthGuard` → `EmailVerifiedGuard` |
| Health | GET | `/api/health` | — |

**UploadsService decision tree:**
```
saveFile(file, imgType?)
 ├─ if CLOUDINARY_CLOUD_NAME is set
 │   ├─ image → upload_stream with transformation:
 │   │   ├─ imgType="square"  → { width:600, height:600, crop:"fill" }
 │   │   ├─ imgType="wide"    → { width:600, height:338, crop:"fill" }
 │   │   └─ default           → { width:1200, crop:"limit" }
 │   │   → quality:"auto", format:"jpg", folder:"breadit"
 │   └─ video → upload_stream as resource_type:"video"
 └─ else (local disk)
     ├─ image → sharp resize → JPEG quality:80 → UUID.jpg → UPLOAD_DIR
     └─ video → raw buffer  → UUID.<ext>       → UPLOAD_DIR
```

**SearchService** runs four parallel Prisma queries: posts (by `desc` ILIKE), users (by `username` or `displayName` ILIKE), hashtags (by `tag` ILIKE), communities (by `name` or `slug` ILIKE). All exclude users/posts blocked by the requesting user. Returns top 5 of each.

---

## 4. Full Dependency Graph

```mermaid
classDiagram
    direction LR

    class PrismaService
    class RedisService
    class NotificationsGateway
    class NotificationsService
    class UploadsService
    class AuthService
    class PostsService
    class InteractionsService
    class UsersService
    class MessagesService
    class CommunitiesService
    class AdminService
    class SearchService
    class HashtagsService

    NotificationsService --> PrismaService
    NotificationsService --> NotificationsGateway

    AuthService --> PrismaService

    PostsService --> PrismaService
    PostsService --> UploadsService
    PostsService --> NotificationsService

    InteractionsService --> PrismaService
    InteractionsService --> NotificationsService

    UsersService --> PrismaService
    UsersService --> NotificationsService

    MessagesService --> PrismaService
    MessagesService --> NotificationsGateway

    CommunitiesService --> PrismaService
    CommunitiesService --> NotificationsService

    AdminService --> PrismaService
    SearchService --> PrismaService
    HashtagsService --> PrismaService
```

---

## 5. Request Lifecycle

```
HTTP Request
    │
    ▼
ThrottlerGuard (global — 120 req/60s per IP, Redis-backed)
    │
    ▼
Route-level Guards (left to right per endpoint)
  JwtAuthGuard          → reads breadit_session cookie, verifies JWT, attaches req.user
  OptionalJwtAuthGuard  → same but never throws; guests continue with req.user=undefined
  EmailVerifiedGuard    → req.user.emailVerified must not be null
  BannedUserGuard       → req.user.banned must be false
  RolesGuard            → req.user.role must match @Roles() decorator
    │
    ▼
ValidationPipe (global)
  • whitelist: true   → strips any DTO field without a class-validator decorator
  • transform: true   → coerces primitives (string→number, etc.)
    │
    ▼
Controller method → Service method → PrismaService → PostgreSQL
                                   → UploadsService → Cloudinary / Local disk
                                   → NotificationsService → PrismaService + NotificationsGateway
                                   → NotificationsGateway → Socket.IO → Redis pub/sub
    │
    ▼
AllExceptionsFilter (global)
  • HttpException  → its own status + message
  • Other errors   → 500 Internal Server Error
  • Logs method, URL, status, name, message, stack for errors ≥ 500
    │
    ▼
HTTP Response
```

---

## 6. TypeScript / Cross-Cutting Notes

### Shared validation pattern across services

All service methods that mutate community state first assert the caller's `CommunityRole` before proceeding:
- `OWNER` required: `deleteCommunity`, `promoteMember`, `transferOwnership`
- `OWNER` or `MOD` required: `update`, `addRule`, `removeRule`, `banUser`, `unbanUser`, `getBannedUsers`, `moderatePost`, `getPendingPosts`

### Fire-and-forget notification pattern

Several places wrap `Promise.all(...)` in `void` to avoid blocking the response:
```ts
void Promise.all(
  members.map(m => this.notificationsService.emit('COMMUNITY_NEW_POST', actorId, m.userId, postId))
);
```
This means notification delivery failures are silently swallowed — the primary operation (post creation, approval, etc.) still succeeds.

### Prisma generated types

`PrismaService` exposes every model as a typed delegate (e.g., `prisma.user`, `prisma.post`). All query results are fully typed from the generated Prisma Client — no manual interface definitions for DB shapes.

### DTO whitelisting

The global `ValidationPipe({ whitelist: true })` silently strips any request body field that does not appear in the DTO class with a `class-validator` decorator. This prevents property injection attacks without any explicit field-exclusion code.

### JWT payload shape

```ts
{
  sub: string,          // User.id
  username: string,
  email: string,
  emailVerified: string | null,  // ISO datetime string
  role: "USER" | "ADMIN",
  banned: boolean,
  iat: number,
  exp: number           // 30 days from iat
}
```
Guards read `payload.sub` as `req.user.id`, `payload.username`, `payload.emailVerified`, `payload.role`, and `payload.banned`.

---

## 7. System Architecture Diagram

```mermaid
graph TB
    subgraph Client["Client (Browser)"]
        direction TB
        NC["Next.js App Router<br/>port 3000"]
        SC["Server Components<br/>serverFetch()"]
        CC["Client Components<br/>TanStack Query v5"]
        MW["Next.js Middleware<br/>breadit_session check"]
        SIO_C["Socket.IO Client<br/>Socket.tsx"]

        NC --> MW
        MW --> SC
        MW --> CC
        CC --> SIO_C
    end

    subgraph Backend["NestJS Backend (port 4000)"]
        direction TB

        subgraph HTTP["HTTP Layer (Fastify)"]
            TH["ThrottlerGuard<br/>120 req / 60 s"]
            GD["Guards<br/>Jwt · OptionalJwt · EmailVerified<br/>Banned · Roles"]
            VP["ValidationPipe<br/>whitelist · transform"]
            EF["AllExceptionsFilter"]
        end

        subgraph Modules["Feature Modules"]
            AUTH["AuthModule<br/>AuthController / AuthService"]
            POSTS["PostsModule<br/>PostsController / PostsService"]
            INTER["InteractionsModule<br/>InteractionsController / InteractionsService"]
            USERS["UsersModule<br/>UsersController / UsersService"]
            NOTIF["NotificationsModule<br/>NotificationsController / NotificationsService"]
            MSG["MessagesModule<br/>MessagesController / MessagesService"]
            COMM["CommunitiesModule<br/>CommunitiesController / CommunitiesService"]
            ADMIN["AdminModule<br/>AdminController / AdminService"]
            SRCH["SearchModule + HashtagsModule + UploadsModule"]
        end

        subgraph Infra["Infrastructure"]
            PRISMA["PrismaService<br/>(global)"]
            REDIS_SVC["RedisService<br/>(global, ioredis)"]
            GW["NotificationsGateway<br/>WebSocket · Redis adapter"]
            UPLOAD_SVC["UploadsService<br/>Cloudinary / sharp"]
        end

        TH --> GD --> VP --> Modules
        Modules --> PRISMA
        Modules --> GW
        NOTIF --> GW
        MSG --> GW
        POSTS --> UPLOAD_SVC
        SRCH --> UPLOAD_SVC
        GW --> REDIS_SVC
        EF -.->|"wraps all responses"| Modules
    end

    subgraph Storage["Persistence"]
        PG[("PostgreSQL 16<br/>port 5433")]
        REDIS[("Redis 7<br/>port 6378")]
    end

    subgraph External["External Services"]
        CLOUD["Cloudinary CDN<br/>(optional)"]
        SMTP["SMTP / Nodemailer<br/>(email verify + reset)"]
        FS["Local Disk<br/>UPLOAD_DIR<br/>(fallback)"]
    end

    %% Client ↔ Backend HTTP
    SC -- "BACKEND_INTERNAL_URL<br/>cookie forwarded" --> HTTP
    CC -- "NEXT_PUBLIC_BACKEND_URL<br/>credentials: include" --> HTTP
    MW -- "cookie check only" --> SC

    %% Client ↔ Backend WebSocket
    SIO_C -- "WebSocket<br/>breadit_session cookie" --> GW

    %% Backend ↔ Storage
    PRISMA -- "Prisma Client" --> PG
    REDIS_SVC -- "ioredis" --> REDIS
    GW -- "pub/sub adapter" --> REDIS

    %% Backend ↔ External
    UPLOAD_SVC -- "upload_stream" --> CLOUD
    UPLOAD_SVC -- "sharp + fs" --> FS
    AUTH -- "nodemailer" --> SMTP

    %% Cookie flow
    AUTH -. "Set-Cookie: breadit_session<br/>httpOnly · SameSite=lax · 30d" .-> Client

    style Client fill:#1e3a5f,color:#fff
    style Backend fill:#1a3a2a,color:#fff
    style Storage fill:#3a1a1a,color:#fff
    style External fill:#2a1a3a,color:#fff
    style HTTP fill:#0d2918,color:#fff
    style Modules fill:#0d2918,color:#fff
    style Infra fill:#0d2918,color:#fff
```

### Component Roles Summary

| Component | Technology | Responsibility |
|-----------|-----------|----------------|
| Next.js App Router | Next.js 15 | SSR pages, middleware auth check, Server/Client component split |
| NestJS + Fastify | NestJS, `@fastify/adapter` | REST API, WebSocket gateway, global guards/pipes/filters |
| PostgreSQL 16 | Prisma ORM | Primary data store — all domain data |
| Redis 7 | ioredis, `nestjs-throttler-storage-redis` | Rate-limit counters + Socket.IO pub/sub across instances |
| Socket.IO Gateway | `@nestjs/websockets`, `@socket.io/redis-adapter` | Real-time notifications and DM delivery |
| Cloudinary | `cloudinary` SDK | CDN media storage with crop/quality transforms (optional) |
| Local disk + sharp | `sharp`, Node `fs` | Media processing fallback when Cloudinary is not configured |
| SMTP (Nodemailer) | `nodemailer` | Transactional email — verification codes and password reset links |

### Data Flow: Creating a Post with Media

```
Browser (Client Component)
  │  POST /api/posts  multipart/form-data
  │  (desc, imgType, communityId?, files[])
  ▼
ThrottlerGuard → JwtAuthGuard → EmailVerifiedGuard
  ▼
PostsController.create()
  │  parses multipart parts manually (Fastify req.parts())
  ▼
PostsService.create()
  ├─ 1. Check community membership + ban      → PrismaService
  ├─ 2. Upload each file                       → UploadsService
  │       ├─ Cloudinary: upload_stream + transform
  │       └─ Local: sharp resize → UUID.jpg → disk
  ├─ 3. prisma.post.create(media[])            → PostgreSQL
  ├─ 4. Upsert Hashtag + PostTag records       → PostgreSQL
  ├─ 5. Fire MENTION notifications             → NotificationsService (void)
  ├─ 6. Fire REPLY notification                → NotificationsService (void)
  └─ 7. Fan-out community notifications        → NotificationsService (void)
          └─ NotificationsService.emit()
                ├─ prisma.notification.create() → PostgreSQL
                └─ gateway.server.to(username).emit('getNotification')
                        └─ Redis pub/sub → all backend instances → Socket.IO client
  ▼
HTTP 201 + post JSON
```

### Data Flow: Direct Message

```
Sender (Client Component)
  │  POST /api/conversations/:id/messages  { body, mediaUrl? }
  ▼
JwtAuthGuard → EmailVerifiedGuard
  ▼
MessagesController.sendMessage()
  ▼
MessagesService.sendMessage()
  ├─ 1. assertMember() — verify sender is in conversation  → PostgreSQL
  ├─ 2. prisma.$transaction([
  │       message.create(),
  │       conversation.update({ updatedAt: now })          → PostgreSQL
  │   ])
  ├─ 3. Look up recipient's username                        → PostgreSQL
  └─ 4. gateway.server.to(recipientUsername)
            .emit('newMessage', { conversationId, message, sender })
                └─ Redis pub/sub → recipient's Socket.IO client
  ▼
HTTP 201 + message JSON

Recipient browser receives 'newMessage' event via WebSocket
  └─ Updates conversation list + chat window in real time
```
