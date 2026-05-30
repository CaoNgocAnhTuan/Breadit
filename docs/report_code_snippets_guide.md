# Breadit Thesis Report - Code Snippets & Technical Implementation Guide

This document compiles the key code snippets representing the **10 core backend functional modules** and **6 core frontend application flows** of the Breadit platform. Each section documents the **Controller (API Routing layer)**, **Service/Gateway (Business Logic layer)**, or **Frontend Components**, providing a precise reference for Chapter 4 (Implementation and Testing) of the thesis report.

---

# PART A: BACKEND IMPLEMENTATION DETAILS

## 1. Module 1: Authentication & Account Verification

### 1.1. Controller (API Routes)
*   **Source File:** [auth.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/auth/auth.controller.ts)
```typescript
@Controller('api/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    return this.auth.login(dto, reply);
  }

  @Post('verify')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  verifyEmail(@Body() dto: VerifyDto) {
    return this.auth.verifyEmail(dto.email, dto.code);
  }
}
```
*   **Technical Analysis:** Exposes RESTful endpoints for authentication. It integrates NestJS `@Throttle` decorators to enforce rate-limiting rules (maximum of 10 requests per 60 seconds) at the entry layer, effectively protecting sensitive operations like Registration, Login, and OTP Verification from automated dictionary and brute-force attacks.

### 1.2. Service (Business Logic)
*   **Source File:** [auth.service.ts](file:///d:/Fork/Breadit/apps/backend/src/auth/auth.service.ts#L192-L223)
```typescript
async login(dto: LoginDto, reply: FastifyReply) {
  const user = await this.prisma.user.findUnique({
    where: { email: dto.email },
    select: { id: true, email: true, username: true, img: true, password: true, emailVerified: true, role: true, banned: true },
  });
  if (!user?.password) throw new UnauthorizedException('Invalid email or password');

  const ok = await bcrypt.compare(dto.password, user.password);
  if (!ok) throw new UnauthorizedException('Invalid email or password');

  const token = await signJwt({
    sub: user.id,
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified?.toISOString() ?? null,
    role: user.role,
    banned: user.banned,
  });
  setSessionCookie(reply, token);

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      emailVerified: user.emailVerified,
      img: user.img,
      role: user.role,
      banned: user.banned,
    },
  };
}
```
*   **Technical Analysis:** Implements secure password verification using `bcrypt.compare` against hashed credentials stored in PostgreSQL. Upon successful authentication, it generates a stateless JSON Web Token (JWT) using the `jose` library containing the user session claims. This JWT is appended to the Fastify response header via a secure, `httpOnly`, `sameSite: 'lax'` cookie, shielding the application from Cross-Site Scripting (XSS) token interception.

---

## 2. Module 2: Feeds & Discovery

### 2.1. Controller (API Routes)
*   **Source File:** [posts.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/posts/posts.controller.ts#L51-L67)
```typescript
@Get()
@UseGuards(OptionalJwtAuthGuard)
findAll(
  @Query('cursor') cursor = '1',
  @Query('user') user: string | undefined,
  @Query('feed') feed: string | undefined,
  @Query('communityId') communityId: string | undefined,
  @Req() req: AuthedRequest,
) {
  return this.postsService.findAll(
    cursor,
    user,
    req.user?.id,
    feed,
    communityId ? Number(communityId) : undefined,
  );
}
```
*   **Technical Analysis:** Handlers request for dynamic feed retrieval. It utilizes an `OptionalJwtAuthGuard` to determine session presence: if the request is authenticated, the client is identified (`req.user.id`) to fetch personalized interactions (such as like and bookmark statuses); if anonymous, the request bypasses session enforcement to serve generic public feeds.

### 2.2. Service (Business Logic & Algorithm)
*   **Source File:** [posts.service.ts](file:///d:/Fork/Breadit/apps/backend/src/posts/posts.service.ts#L226-L309)
```typescript
function computeExploreScoreFixed(input: { likes: number; comments: number; reposts: number; ageHours: number }): number {
  const score = input.likes + input.comments * 2 + input.reposts * 3 - input.ageHours * 0.25;
  return Math.floor(score * 100);
}

// Inside PostsService.findAll() for feed === 'explore'
const scored = rows
  .map((p: any) => {
    const createdAtMs = new Date(p.createdAt).getTime();
    const ageHours = Math.max(0, (now - createdAtMs) / (1000 * 60 * 60));
    const likes = p?._count?.likes ?? 0;
    const comments = p?._count?.comments ?? 0;
    const reposts = p?._count?.rePosts ?? 0;
    const scoreFixed = computeExploreScoreFixed({ likes, comments, reposts, ageHours });
    return { post: p, scoreFixed, id: p.id as number, userId: p.userId as string };
  })
  .sort((a, b) => (b.scoreFixed - a.scoreFixed) || (b.id - a.id));

const diversified = applyExploreDiversity(scored, 3);
```
*   **Technical Analysis:** Implements a time-decay explore feed ranking algorithm. The system aggregates dynamic user signals (likes, comments, reposts) and applies a linear decay factor based on post age (`ageHours`). It further applies a diversity filter (`applyExploreDiversity`) that limits consecutive posts from the same author to 3, ensuring feed variety and preventing monopoly of the explore feed by single active users.

---

## 3. Module 3: Post Management

### 3.1. Controller (API Routes)
*   **Source File:** [posts.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/posts/posts.controller.ts#L77-L121)
```typescript
@Post()
@HttpCode(HttpStatus.CREATED)
@UseGuards(JwtAuthGuard, EmailVerifiedGuard)
async create(@Req() req: FastifyRequest & { user?: { id: string } }) {
  const body: {
    desc?: string;
    imgType?: string;
    rePostId?: number;
    isSensitive?: boolean;
    communityId?: number;
  } = {};
  const bufferedFiles: { buffer: Buffer; mimetype: string; filename: string }[] = [];

  try {
    for await (const part of req.parts()) {
      if (part.type === 'field') {
        const val = part.value as string;
        if (part.fieldname === 'desc') body.desc = val;
        else if (part.fieldname === 'imgType') body.imgType = val;
        else if (part.fieldname === 'rePostId') {
          const n = parseInt(val, 10);
          if (!isNaN(n)) body.rePostId = n;
        } else if (part.fieldname === 'communityId') {
          const n = parseInt(val, 10);
          if (!isNaN(n)) body.communityId = n;
        } else if (part.fieldname === 'isSensitive') {
          body.isSensitive = val === 'true';
        }
      } else if (part.type === 'file') {
        const buffer = await part.toBuffer();
        bufferedFiles.push({
          buffer,
          mimetype: part.mimetype,
          filename: part.filename,
        });
      }
    }
  } catch (err) {
    const mapped = mapMultipartUploadError(err);
    if (mapped.status === 'payload_too_large') throw new PayloadTooLargeException(mapped.message);
    throw new BadRequestException(mapped.message);
  }

  return this.postsService.create(req.user!.id, body, bufferedFiles);
}
```
*   **Technical Analysis:** Handles post creation requests submitted via `multipart/form-data`. Because the project runs on Fastify instead of Express, file uploads are processed asynchronously using non-blocking streams (`req.parts()`), which significantly reduces memory utilization and avoids high-RAM spikes during concurrent heavy file uploads.

### 3.2. Service (Business Logic)
*   **Source File:** [posts.service.ts](file:///d:/Fork/Breadit/apps/backend/src/posts/posts.service.ts#L462-L483)
```typescript
if (body.desc) {
  const tags = [
    ...new Set(
      [...body.desc.matchAll(/#([a-zA-Z0-9_]+)/g)].map((m) =>
        m[1].toLowerCase(),
      ),
    ),
  ];
  if (tags.length > 0) {
    await Promise.all(
      tags.map((tag) =>
        this.prisma.hashtag
          .upsert({ where: { tag }, create: { tag }, update: {} })
          .then((ht) =>
            this.prisma.postTag.upsert({
              where: { postId_hashtagId: { postId: post.id, hashtagId: ht.id } },
              create: { postId: post.id, hashtagId: ht.id },
              update: {},
            }),
          ),
      ),
    );
  }
}
```
*   **Technical Analysis:** Executes post insertion and handles automatic hashtag discovery. It uses an ES6 RegExp `matchAll(/#([a-zA-Z0-9_]+)/g)` search to isolate tags, eliminates duplicate entries using a `Set`, and executes concurrent database `upsert` queries inside a `Promise.all` block. This establishes hashtag records and many-to-many relationship rows in SQL in a single execution block.

---

## 4. Module 4: Post Interaction

### 4.1. Controller (API Routes)
*   **Source File:** [comments.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/comments/comments.controller.ts#L49-L57)
```typescript
@Get('posts/:postId/comments')
@UseGuards(OptionalJwtAuthGuard)
findByPost(
  @Param('postId', ParseIntPipe) postId: number,
  @Query('sort') sort: string = 'relevant',
  @Req() req: AuthedRequest,
) {
  return this.commentsService.findByPost(postId, req.user?.id, sort);
}
```
*   **Technical Analysis:** Exposes retrieval routes for comment feeds. It integrates NestJS `ParseIntPipe` to sanitize and cast the parameter `postId` from a raw string into an integer directly at the controller routing layer, blocking malformed input types before database querying.

### 4.2. Service (Business Logic)
*   **Source File:** [comments.service.ts](file:///d:/Fork/Breadit/apps/backend/src/comments/comments.service.ts#L39-L88)
```typescript
async findByPost(postId: number, userId?: string, sort = 'relevant') {
  const post = await this.prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) throw new NotFoundException();

  const include = this.commentInclude(userId);

  let topLevelOrderBy: object | object[];
  if (sort === 'top') {
    topLevelOrderBy = { likes: { _count: 'desc' as const } };
  } else if (sort === 'recent') {
    topLevelOrderBy = { createdAt: 'desc' as const };
  } else {
    topLevelOrderBy = { createdAt: 'desc' as const };
  }

  const comments = await this.prisma.comment.findMany({
    where: { postId, parentCommentId: null, deletedAt: null },
    orderBy: topLevelOrderBy,
    include: {
      ...include,
      replies: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: {
          ...include,
          replies: {
            where: { deletedAt: null },
            orderBy: { createdAt: 'asc' },
            include: {
              ...include,
              replies: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' },
                include: {
                  ...include,
                  replies: {
                    where: { deletedAt: null },
                    orderBy: { createdAt: 'asc' },
                    include,
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return comments;
}
```
*   **Technical Analysis:** Resolves threaded nested hierarchical comment streams. The service executes recursive queries through Prisma, retrieving top-level parent comments and nesting subsequent children (`replies`) up to 5 levels deep. Root replies are sorted dynamically according to popularity (like count) or recency, while inner child replies are sorted chronologically (`createdAt: asc`) to maintain coherent thread conversations.

---

## 5. Module 5: User Relationship Management

### 5.1. Controller (API Routes)
*   **Source File:** [users.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/users/users.controller.ts#L37-L42)
```typescript
@Post(':id/block')
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard, BannedUserGuard)
toggleBlock(@Param('id') targetId: string, @Req() req: AuthedRequest) {
  return this.usersService.toggleBlock(req.user!.id, targetId);
}
```
*   **Technical Analysis:** Endpoint that handles user blocks. Combines session validation (`JwtAuthGuard`) and security moderation checks (`BannedUserGuard`) to prevent blocked or banned users from initiating relationship modifications on the platform.

### 5.2. Service (Business Logic)
*   **Source File:** [users.service.ts](file:///d:/Fork/Breadit/apps/backend/src/users/users.service.ts#L314-L350)
```typescript
async toggleBlock(blockerId: string, blockedId: string) {
  const existing = await this.prisma.block.findFirst({
    where: { blockerId, blockedId },
  });

  if (existing) {
    await this.prisma.block.delete({ where: { id: existing.id } });
    // Blocked peer lists changed for both directions.
    await this.blockService.invalidateBlockedPeers(blockerId);
    await this.blockService.invalidateBlockedPeers(blockedId);
    await this.cache.incrNumber('v:user', [blockerId]);
    await this.cache.incrNumber('v:user', [blockedId]);
    return { blocked: false };
  }

  await Promise.all([
    this.prisma.block.create({ data: { blockerId, blockedId } }),
    this.prisma.follow.deleteMany({
      where: {
        OR: [
          { followerId: blockerId, followingId: blockedId },
          { followerId: blockedId, followingId: blockerId },
        ],
      },
    }),
  ]);

  // Blocked peer lists changed for both directions.
  await this.blockService.invalidateBlockedPeers(blockerId);
  await this.blockService.invalidateBlockedPeers(blockedId);
  // Blocking severs mutual follows, so cached followees ids for both users must be invalidated.
  await this.cache.del('graph:follows', [blockerId]);
  await this.cache.del('graph:follows', [blockedId]);
  await this.cache.incrNumber('v:user', [blockerId]);
  await this.cache.incrNumber('v:user', [blockedId]);
  return { blocked: true };
}
```
*   **Technical Analysis:** Implements bidirectional blocking logic. When a block is established, the database removes mutual follow instances in a unified transaction (`deleteMany`). Cache invalidation commands are pushed immediately to Redis to delete old relationship state graphs (`graph:follows` and `graph:blockedPeers`), enforcing instant privacy boundaries on subsequent page requests.

---

## 6. Module 6: Profile Management

### 6.1. Controller (API Routes)
*   **Source File:** [users.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/users/users.controller.ts#L91-L107)
```typescript
@Get(':username/posts')
@UseGuards(OptionalJwtAuthGuard)
getProfilePosts(
  @Param('username') username: string,
  @Query('tab') tab: string,
  @Query('cursor') cursor: string,
  @Query('q') q: string,
  @Req() req: AuthedRequest,
) {
  return this.usersService.getPostsByTab(
    username,
    tab ?? 'posts',
    parseInt(cursor ?? '1', 10),
    req.user?.id,
    q ?? '',
  );
}
```
*   **Technical Analysis:** Defines routes for loading specific user profiles. Uses the `OptionalJwtAuthGuard` to verify session parameters, allowing guests to read profiles while letting authenticated users pass search queries (`q`) and tab queries.

### 6.2. Service (Business Logic)
*   **Source File:** [users.service.ts](file:///d:/Fork/Breadit/apps/backend/src/users/users.service.ts#L97-L166)
```typescript
async getPostsByTab(
  username: string,
  tab: string,
  cursor: number,
  currentUserId?: string,
  q?: string,
) {
  const profileUser = await this.prisma.user.findUnique({
    where: { username },
    select: { id: true },
  });
  if (
    profileUser &&
    currentUserId &&
    profileUser.id !== currentUserId &&
    (await this.blockService.isBlockedPair(currentUserId, profileUser.id))
  ) {
    throw new ForbiddenException('Profile content unavailable');
  }

  if (tab === 'replies') {
    return this.getUserComments(username, cursor, currentUserId);
  }

  const term = (q ?? '').trim();

  let whereCondition: object;
  if (tab === 'media') {
    whereCondition = {
      user: { username },
      parentPostId: null,
      deletedAt: null,
      communityId: null,
      media: { some: {} },
    };
  } else if (tab === 'likes') {
    whereCondition = { likes: { some: { user: { username } } }, deletedAt: null };
  } else {
    whereCondition = {
      user: { username },
      parentPostId: null,
      deletedAt: null,
      communityId: null,
      ...(term
        ? {
            OR: [
              { desc: { contains: term, mode: 'insensitive' as const } },
              { rePost: { desc: { contains: term, mode: 'insensitive' as const } } },
            ],
          }
        : {}),
    };
  }

  const include = this.postInclude(currentUserId);
  const posts = await this.prisma.post.findMany({
    where: whereCondition,
    include: {
      rePost: { include },
      ...include,
    },
    take: POST_LIMIT,
    skip: (cursor - 1) * POST_LIMIT,
    orderBy: { createdAt: 'desc' },
  });
  const total = await this.prisma.post.count({ where: whereCondition });
  const hasMore = cursor * POST_LIMIT < total;
  const nextCursor = hasMore ? cursor + 1 : null;
  return { posts, hasMore, nextCursor };
}
```
*   **Technical Analysis:** Dynamically compiles PostgreSQL `where` conditions based on selected categories (`media`, `likes`, `posts`). Security checks are enforced inside the service (`isBlockedPair`) to verify blocking status before compiling profile content, blocking malicious API requests from bypass attempts.

---

## 7. Module 7: Direct Messaging

### 7.1. Controller (API Routes)
*   **Source File:** [messages.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/messages/messages.controller.ts#L81-L90)
```typescript
@Post(':id/messages')
@HttpCode(HttpStatus.CREATED)
@UseGuards(EmailVerifiedGuard)
sendMessage(
  @Req() req: AuthedRequest,
  @Param('id', ParseIntPipe) id: number,
  @Body() dto: CreateMessageDto,
) {
  return this.messagesService.sendMessage(id, req.user!.id, dto);
}
```
*   **Technical Analysis:** Routing endpoint for message dispatching. Guarded by the `EmailVerifiedGuard` to restrict real-time communication privileges to verified users, preventing malicious spam and automated bot registration flows.

### 7.2. Service (Business Logic)
*   **Source File:** [messages.service.ts](file:///d:/Fork/Breadit/apps/backend/src/messages/messages.service.ts#L275-L325)
```typescript
async sendMessage(
  conversationId: number,
  senderId: string,
  dto: CreateMessageDto,
) {
  await this.assertMember(conversationId, senderId);
  await this.assertConversationNotBlocked(conversationId, senderId);

  if (!dto.body && !dto.mediaUrl) {
    throw new ForbiddenException('Message must have body or media');
  }

  const [message] = await this.prisma.$transaction([
    this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        body: dto.body ?? null,
        mediaUrl: dto.mediaUrl ?? null,
      },
    }),
    this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);

  const [senderUser, otherMember] = await Promise.all([
    this.prisma.user.findUnique({
      where: { id: senderId },
      select: MEMBER_SELECT,
    }),
    this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: senderId } },
      include: { user: { select: { username: true } } },
    }),
  ]);

  if (otherMember?.user) {
    this.gateway.server
      ?.to(otherMember.user.username)
      .emit('newMessage', { conversationId, message, sender: senderUser });
  }

  // Receiver unread count changed due to new message.
  if (otherMember) {
    await this.cache.del('dm:unreadCount', [conversationId, otherMember.userId]);
  }

  return message;
}
```
*   **Technical Analysis:** Encapsulates message creation and conversation metadata updates within an ACID `$transaction` block. Once changes are successfully written to SQL, the service leverages the Socket.io WebSocket Gateway to broadcast the message payload (`newMessage` event) to the recipient's secure connection channel, subsequently invalidating the unread count in Redis.

---

## 8. Module 8: Real-time Notifications

### 8.1. Controller (API Routes)
*   **Source File:** [notifications.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/notifications/notifications.controller.ts#L22-L34)
```typescript
@Get()
@UseGuards(JwtAuthGuard)
findAll(
  @Req() req: AuthedRequest,
  @Query('cursor') cursor: string,
  @Query('unread') unread: string,
) {
  return this.notificationsService.findAll(
    req.user!.id,
    parseInt(cursor ?? '1', 10),
    unread === 'true',
  );
}
```
*   **Technical Analysis:** Handlers request for reading the authenticated user's notification log history, supporting paging via integer cursors and filters for read/unread notification states.

### 8.2. WebSocket Gateway (Real-time Hub)
*   **Source File:** [notifications.gateway.ts](file:///d:/Fork/Breadit/apps/backend/src/notifications/notifications.gateway.ts#L16-L55)
```typescript
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer() server: Server;

  afterInit(server: Server) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    server.adapter(createAdapter(pubClient, subClient));
  }

  async handleConnection(socket: Socket) {
    const cookieHeader = socket.handshake.headers.cookie ?? '';
    const match = /breadit_session=([^;]+)/.exec(cookieHeader);
    if (!match) {
      socket.disconnect();
      return;
    }
    try {
      await verifyJwt(decodeURIComponent(match[1]));
    } catch {
      socket.disconnect();
    }
  }

  @SubscribeMessage('newUser')
  handleNewUser(
    @ConnectedSocket() socket: Socket,
    @MessageBody() username: string,
  ) {
    socket.join(username);
  }
}
```
*   **Technical Analysis:** Implements a full-duplex WebSocket hub powered by Socket.io. It integrates `@socket.io/redis-adapter` to enable cluster pub/sub synchronization, allowing horizontal scaling of backend instances. It reads the incoming handshake headers to fetch the `breadit_session` cookie, validation-checking the JWT signature before establishing the connection.

---

## 9. Module 9: Community Management

### 9.1. Controller (API Routes)
*   **Source File:** [communities.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/communities/communities.controller.ts#L183-L193)
```typescript
@Post(':id/posts/:postId/moderate')
@UseGuards(JwtAuthGuard, BannedUserGuard)
moderatePost(
  @Req() req: AuthedRequest,
  @Param('id', ParseIntPipe) id: number,
  @Param('postId', ParseIntPipe) postId: number,
  @Body('action') action: 'APPROVE' | 'REMOVE',
) {
  return this.communitiesService.moderatePost(req.user!.id, id, postId, action);
}
```
*   **Technical Analysis:** Exposes endpoint for community moderators to approve or reject pending member posts, validating basic request parameters (`id` and `postId` format) before calling the Service layer.

### 9.2. Service (Business Logic)
*   **Source File:** [communities.service.ts](file:///d:/Fork/Breadit/apps/backend/src/communities/communities.service.ts#L368-L398)
```typescript
async moderatePost(userId: string, communityId: number, postId: number, action: 'APPROVE' | 'REMOVE') {
  const member = await this.prisma.communityMember.findUnique({
    where: { userId_communityId: { userId, communityId } },
  });

  if (!member || (member.role !== CommunityRole.OWNER && member.role !== CommunityRole.MOD)) {
    throw new ForbiddenException('Only owners and mods can moderate posts');
  }

  const post = await this.prisma.post.findFirst({ where: { id: postId, communityId } });
  if (!post) throw new NotFoundException('Post not found in this community');

  if (action === 'APPROVE') {
    await this.prisma.post.update({ where: { id: postId }, data: { isApproved: true } });

    // Notify all community members (except the post author) about the new post
    const communityMembers = await this.prisma.communityMember.findMany({
      where: { communityId },
      select: { userId: true },
    });
    void Promise.all(
      communityMembers
        .filter((m) => m.userId !== post.userId)
        .map((m) => this.notificationsService.emit('COMMUNITY_NEW_POST', post.userId, m.userId, postId)),
    );
  } else {
    await this.prisma.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });
  }

  return { success: true };
}
```
*   **Technical Analysis:** Implements community-level role-based access control (RBAC). It verifies the member's moderator/owner status in PostgreSQL before updating the target post's `isApproved` flag. Approved posts trigger async notifications (`COMMUNITY_NEW_POST`) dispatched concurrently to all community members via `Promise.all`.

---

## 10. Module 10: Administrative Moderation

### 10.1. Controller (API Routes)
*   **Source File:** [admin.controller.ts](file:///d:/Fork/Breadit/apps/backend/src/admin/admin.controller.ts#L32-L37)
```typescript
@Post('users/:id/ban')
@HttpCode(HttpStatus.OK)
banUser(@Param('id') id: string) {
  return this.adminService.setBanStatus(id, true);
}
```
*   **Technical Analysis:** Controller endpoint for global moderation. Access is restricted using global guards (`RolesGuard`) to verify that the executing account holds a site-wide role of `'ADMIN'` before processing bans.

### 10.2. Service (Business Logic)
*   **Source File:** [admin.service.ts](file:///d:/Fork/Breadit/apps/backend/src/admin/admin.service.ts#L46-L67)
```typescript
async setBanStatus(id: string, banned: boolean) {
  const user = await this.prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true },
  });
  if (!user) throw new NotFoundException();

  await this.prisma.user.update({
    where: { id },
    data: { banned },
  });

  // Emit real-time event so the banned user's browser reacts immediately
  // The client socket joins a room keyed by username (see Socket.tsx → "newUser" event)
  if (banned) {
    this.notificationsGateway.server
      .to(user.username)
      .emit('accountBanned');
  }

  return { ok: true };
}
```
*   **Technical Analysis:** Updates a user account's banned state in PostgreSQL. To ensure instant moderation enforcement, the service immediately emits an `accountBanned` event to the user's active WebSocket room. The client-side application listens for this event to clear session state, revoke cookies, and force redirect the user to prevent further interaction.

---

# PART B: FRONTEND IMPLEMENTATION DETAILS

This section documents the frontend implementation structured according to the **6 core user-interaction flows/pages** defined on the Breadit web client.

## 11. Flow 1: Authentication & Onboarding Flow (/sign-up, /sign-in, /verify)

### 11.1. Registration Screen (Sign-Up Page)
*   **Source File:** [page.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/sign-up/[[...sign-up]]/page.tsx#L9-L56)
```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SignUpPage = () => {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => {
    if (value && !EMAIL_RE.test(value)) {
      setEmailError("Invalid email address");
    } else {
      setEmailError(null);
    }
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get("email") ?? "");
    const payload = {
      username: String(fd.get("username") ?? ""),
      email,
      password: String(fd.get("password") ?? ""),
    };

    if (!EMAIL_RE.test(email)) {
      setEmailError("Invalid email address");
      return;
    }

    setLoading(true);
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data?.message ? String(data.message) : "Failed to register");
      setLoading(false);
      return;
    }

    setLoading(false);
    router.push(`/verify?email=${encodeURIComponent(email)}`);
  };

  return (
    <form onSubmit={onSubmit}>
      {/* ... form inputs for username, email, password ... */}
    </form>
  );
};
```

### 11.2. Login Screen (Sign-In Page)
*   **Source File:** [page.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/sign-in/[[...sign-in]]/page.tsx#L9-L34)
```typescript
function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const verified = searchParams.get("verified");
  const reset = searchParams.get("reset");
  const banned = searchParams.get("banned");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: fd.get("email"), password: fd.get("password") }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Invalid email or password");
    } else {
      router.push("/");
      router.refresh();
    }
  };

  return (
    <form onSubmit={onSubmit}>
      {/* ... inputs for email and password ... */}
    </form>
  );
}
```

### 11.3. OTP Verification Screen (Verify Page)
*   **Source File:** [page.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/verify/page.tsx#L8-L38)
```typescript
function VerifyForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const email = searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await api("/api/auth/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    });

    setLoading(false);

    if (res.ok) {
      router.push("/sign-in?verified=1");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setError(data?.message ?? "Invalid or expired code. Please try again.");
  };

  return (
    <form onSubmit={onSubmit}>
      {/* ... 6-digit verification code input ... */}
    </form>
  );
}
```

### 11.4. Technical Analysis
This flow manages the client-side authentication and onboarding experience:
1.  **Regex-based Client Validation:** During user registration, the system validates the email format instantly in real-time (`onChange`) utilizing the `validateEmail` function and a custom regular expression (`EMAIL_RE`). This provides instant visual feedback to the user, preventing unnecessary HTTP requests to the backend API.
2.  **Stateful Query Parameter Interception:** The Login component reads URL query parameters (`verified`, `reset`, `banned`) to dynamically display administrative status alerts (such as informing banned users of account suspension).
3.  **OTP Submission Flow:** Upon successful registration, the client routes the user to the OTP page. The component enforces a strict 6-digit numeric pattern verification (`pattern="[0-9]{6}"` and `inputMode="numeric"`) before enabling form submission. It invokes the verification API asynchronously and redirects the user to the login screen with a success query parameter upon approval.

---

## 12. Flow 2: Main Feed & Discovery Page (/ - Home & Explore Feed)

### 12.1. Feed Routing Layout
*   **Source File:** [page.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/(board)/page.tsx#L5-L16)
```typescript
const Homepage = async ({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string }>;
}) => {
  const params = await searchParams;
  const validFeeds = ["explore", "following", "communities"] as const;
  const feed = validFeeds.includes((params.feed ?? "") as (typeof validFeeds)[number])
    ? (params.feed as (typeof validFeeds)[number])
    : undefined;

  return (
    <div>
      {/* ... tab navigation links ... */}
      <Share />
      <Feed feed={feed} />
    </div>
  );
};
```

### 12.2. Infinite Feed Component (useInfiniteQuery & Infinite Scroll)
*   **Source File:** [InfiniteFeed.tsx](file:///d:/Fork/Breadit/apps/frontend/src/components/InfiniteFeed.tsx#L28-L75)
```typescript
const InfiniteFeed = ({
  userProfileId,
  feed,
  communityId,
  initialData,
}: {
  userProfileId?: string;
  feed?: string;
  communityId?: number;
  initialData?: PostPage;
}) => {
  const { data, error, hasNextPage, fetchNextPage } = useInfiniteQuery<
    PostPage,
    Error,
    PostFeedData,
    (string | number)[],
    number | string
  >({
    queryKey: ["posts", userProfileId ?? "", feed ?? "", communityId ?? ""],
    queryFn: ({ pageParam }) =>
      fetchPosts(pageParam as number | string, userProfileId, feed, communityId),
    initialPageParam: 1,
    initialData: initialData
      ? { pages: [initialData], pageParams: [1] }
      : undefined,
    refetchOnMount: true,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  if (error) return "Something went wrong!";
  if (!data) return "Loading...";

  const allPosts = data.pages.flatMap((page: PostPage) => page.posts);

  return (
    <InfiniteScroll
      dataLength={allPosts.length}
      next={fetchNextPage}
      hasMore={!!hasNextPage}
      loader={<h1>Posts are loading...</h1>}
      endMessage={<h1>All posts loaded!</h1>}
    >
      {allPosts.map((post: PostWithDetails) => (
        <Post key={post.id} post={post} />
      ))}
    </InfiniteScroll>
  );
};
```

### 12.3. Technical Analysis
The Main Feed interface uses TanStack React Query to implement seamless infinite scroll:
1.  **URL-Driven Tabs:** The `/` (Home) route parses the URL search parameters to retrieve the specific active feed type (`For you`, `Explore`, `Following`, `Communities`). This value is passed down to the `Feed` wrapper.
2.  **useInfiniteQuery Integration:** The client-side logic leverages TanStack's `useInfiniteQuery` hook. By specifying an initial page parameter of `1`, the client fetches post items asynchronously. The query key depends on the active tab and filters (`userProfileId`, `feed`, `communityId`), enabling independent cache management for each view.
3.  **Cursor-based Pagination & Scroll Trigger:** The API returns a `nextCursor` value. The hook reads this via `getNextPageParam` to keep track of the subsequent page's cursor. The `InfiniteScroll` component monitors window scroll parameters; when the user nears the page bottom, it triggers `fetchNextPage`, requesting the next page. This forms a smooth, Twitter-like feed scroll experience.

---

## 13. Flow 3: Direct Messaging & Chat Interface (/messages)

### 13.1. Messages Layout (Server-side Fetching)
*   **Source File:** [layout.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/(board)/messages/layout.tsx#L5-L26)
```typescript
export default async function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const res = await serverFetch("/api/conversations");
  const initialData = res.ok
    ? await res.json()
    : { items: [], nextCursor: null };

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-[360px] border-r border-borderGray overflow-hidden flex flex-col shrink-0">
        <ConversationList initialData={initialData} />
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}
```

### 13.2. Real-time Message Thread (WebSocket Event Listeners)
*   **Source File:** [MessageThread.tsx](file:///d:/Fork/Breadit/apps/frontend/src/components/MessageThread.tsx#L102-L123)
```typescript
  // Inside MessageThread component: Listening for incoming messages
  useEffect(() => {
    const handler = (payload: { conversationId: number; message: MessageItem }) => {
      if (payload.conversationId !== conversationId) return;
      appendToCache(payload.message);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    };
    
    const readHandler = (payload: { conversationId: number; readerId: string }) => {
      if (payload.conversationId === conversationId && payload.readerId === otherUser.id) {
        setPartnerReadAt(new Date());
      }
    };

    socket.on("newMessage", handler);
    socket.on("messageRead", readHandler);
    return () => { 
      socket.off("newMessage", handler); 
      socket.off("messageRead", readHandler);
    };
  }, [conversationId, otherUser.id]);
```

### 13.3. Typing Indicator Hook (WebSocket Emitters)
*   **Source File:** [useTypingIndicator.ts](file:///d:/Fork/Breadit/apps/frontend/src/hooks/useTypingIndicator.ts#L13-L81)
```typescript
export function useTypingIndicator(conversationId: number, username: string) {
  const [partnerTyping, setPartnerTyping] = useState(false);

  const isTypingRef = useRef(false);
  const sendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // join / leave conversation room
  useEffect(() => {
    socket.emit("joinConversation", conversationId);
    return () => {
      socket.emit("leaveConversation", conversationId);
      if (isTypingRef.current) {
        socket.emit("stopTyping", { conversationId });
        isTypingRef.current = false;
      }
    };
  }, [conversationId]);

  // listen for partner typing events
  useEffect(() => {
    const onTyping = (payload: { conversationId: number }) => {
      if (payload.conversationId !== conversationId) return;
      setPartnerTyping(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => setPartnerTyping(false), 4000);
    };

    const onStop = (payload: { conversationId: number }) => {
      if (payload.conversationId !== conversationId) return;
      setPartnerTyping(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };

    socket.on("userTyping", onTyping);
    socket.on("userStopTyping", onStop);
    return () => {
      socket.off("userTyping", onTyping);
      socket.off("userStopTyping", onStop);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [conversationId]);

  const onKeystroke = () => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      socket.emit("startTyping", { conversationId, username });
    }
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    sendTimerRef.current = setTimeout(() => {
      isTypingRef.current = false;
      socket.emit("stopTyping", { conversationId });
    }, 3000);
  };

  const onSent = () => {
    if (sendTimerRef.current) clearTimeout(sendTimerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      socket.emit("stopTyping", { conversationId });
    }
  };

  return { partnerTyping, onKeystroke, onSent };
}
```

### 13.4. Technical Analysis
The Direct Messaging module implements real-time bidirectional messaging and typing indicator states using WebSockets:
1.  **WebSocket Handshake and Session Security:** The React client establishes a persistent connection with the NestJS Socket.io server (defined in `socket.ts`), utilizing `withCredentials: true` to forward session credentials.
2.  **Event-Driven Thread Updates:** Inside `MessageThread.tsx`, the component registers event listeners (`socket.on("newMessage")`). When the server emits a new message payload, the callback triggers immediately, modifying the TanStack React Query cache dynamically via `queryClient.setQueryData` to append the message to the view, and performing a smooth programmatic scroll to focus the new message.
3.  **Room-scoped Typing Broadcasts:** The custom hook `useTypingIndicator` manages room-scoped typing indicators. Upon mount, the client joins a conversation room (`joinConversation`). Typing input textareas trigger `onKeystroke()`, which emits `startTyping` events and sets a 3-second debounce timer. If typing stops, `stopTyping` is emitted. Meanwhile, the client listens to incoming `userTyping` / `userStopTyping` events to display real-time "typing..." feedback.

---

## 14. Flow 4: User Profile Page (/[username])

### 14.1. Server-Side Profile Page Route
*   **Source File:** [page.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/(board)/[username]/page.tsx#L50-L111)
```typescript
const UserPage = async ({
  params,
}: {
  params: Promise<{ username: string }>;
}) => {
  const session = await getSession();
  const userId = session?.user?.id;
  const username = (await params).username;

  const res = await serverFetch(`/api/users/${username}`);
  if (!res.ok) return notFound();
  const user = await res.json();
  const profileRestricted = !!user.profileRestricted;
  const theyBlockedYou = user.blockedYou === true;
  const youBlockedThem = user.blockedByYou === true;

  return (
    <div className="">
      <div className="flex items-center gap-8 sticky top-0 backdrop-blur-md p-4 z-10 bg-[#00000084]">
        <Link href="/">
          <Image path="icons/back.svg" alt="back" w={24} h={24} />
        </Link>
        <h1 className="font-bold text-lg">
          {profileRestricted ? `@${user.username}` : user.displayName ?? user.username}
        </h1>
      </div>

      {profileRestricted ? (
        <div className="px-4 py-6 flex flex-col gap-4">
          <p className="text-textGray text-sm">
            {youBlockedThem && !theyBlockedYou && <>You have blocked <span className="text-white font-semibold">@{user.username}</span>.</>}
            {theyBlockedYou && !youBlockedThem && <>You can’t view this profile because <span className="text-white font-semibold">@{user.username}</span> has blocked you.</>}
          </p>
        </div>
      ) : (
        <>
          {/* Cover image, avatar, bio, follower count, and ProfilePostSearch component */}
          <ProfilePostSearch username={username} />
        </>
      )}
    </div>
  );
};
```

### 14.2. Profile Tab Switching
*   **Source File:** [ProfileTabs.tsx](file:///d:/Fork/Breadit/apps/frontend/src/components/ProfileTabs.tsx#L9-L32)
```typescript
const ProfileTabs = ({ username, query }: { username: string; query?: string }) => {
  const [activeTab, setActiveTab] = useState<Tab>("posts");

  return (
    <div>
      <div className="flex border-b border-borderGray">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-4 capitalize text-sm font-medium hover:bg-white/5 transition-colors ${
              activeTab === tab
                ? "text-white border-b-2 border-iconBlue"
                : "text-textGray"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <ProfileTabFeed username={username} tab={activeTab} query={query ?? ""} />
    </div>
  );
};
```

### 14.3. Profile Feed Fetcher
*   **Source File:** [ProfileTabFeed.tsx](file:///d:/Fork/Breadit/apps/frontend/src/components/ProfileTabFeed.tsx#L825-L849)
```typescript
const ProfileTabFeed = ({ username, tab, query }) => {
  const { data, isPending } = useInfiniteQuery({
    queryKey: ["profile-posts", username, tab, query],
    queryFn: async ({ pageParam = 1 }) => {
      const params = new URLSearchParams({ tab, cursor: String(pageParam) });
      if (tab === "posts" && query.trim()) params.set("q", query.trim());
      const res = await fetch(`${BACKEND_URL}/api/users/${username}/posts?${params.toString()}`, {
        credentials: "include"
      });
      if (res.status === 403) {
        return { posts: [], hasMore: false, forbidden: true };
      }
      return res.json();
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const forbidden = data?.pages?.some((page) => page.forbidden);
  if (forbidden) {
    return <p className="p-8 text-center text-textGray">Profile content isn't available.</p>;
  }

  return (
    <div>
      {/* ... render profile tab items ... */}
    </div>
  );
};
```

### 14.4. Technical Analysis
The User Profile module renders profile metrics and handles tabbed queries dynamically:
1.  **Block-Aware Server Rendering:** In `[username]/page.tsx`, the server performs a pre-fetch on the target user's details. If relationship flags (`blockedYou` or `blockedByYou`) are true, the page is flagged as `profileRestricted`, returning a localized privacy screen instead of sensitive details.
2.  **Interactive Tabs:** In `ProfileTabs.tsx`, the client switches between tab selections (`posts`, `replies`, `media`, `likes`). Updating the `activeTab` state changes the query key of `useInfiniteQuery` in `ProfileTabFeed.tsx`.
3.  **Dynamic Query Invalidation:** Changing the tab triggers a react-query cache reset and initiates a new HTTP request targeting `/api/users/${username}/posts?tab=${activeTab}` with credentials. The component captures `403 Forbidden` statuses to prevent restricted users from accessing api-sensitive details.

---

## 15. Flow 5: Community Page (/c/[slug])

### 15.1. Community Server Component Route
*   **Source File:** [page.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/(board)/c/[slug]/page.tsx#L8-L77)
```typescript
async function getCommunity(slug: string) {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("breadit_session")?.value;

    const res = await fetch(`${process.env.BACKEND_INTERNAL_URL}/api/communities/${slug}`, {
      headers: sessionToken ? { Cookie: `breadit_session=${sessionToken}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function CommunityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const community = await getCommunity(slug);

  if (!community) notFound();

  if (community.isBanned) {
    return (
      <div className="">
        <CommunityHeader community={community} />
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <span className="text-4xl">🚫</span>
          <h2 className="text-xl font-bold">You are banned from this community</h2>
        </div>
      </div>
    );
  }

  const initialPosts = await getInitialPosts(community.id);
  const role = community.membership?.role ?? null;
  const isStaff = role === "OWNER" || role === "MOD";

  return (
    <div className="">
      <CommunityHeader community={community} />
      {isStaff && <PendingPostsBanner communityId={community.id} />}
      <Share communityId={community.id} />
      <InfiniteFeed communityId={community.id} initialData={initialPosts} />
    </div>
  );
}
```

### 15.2. Community Header (Join / Leave State Management)
*   **Source File:** [CommunityHeader.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/(board)/c/[slug]/CommunityHeader.tsx#L36-L103)
```typescript
export default function CommunityHeader({ community }) {
  const session = useSession();
  const user = session?.user;
  const router = useRouter();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api(`/api/communities/${community.id}/join`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Failed to join/leave community");
      return res.json();
    },
    onSuccess: () => {
      router.refresh();
    },
    onError: (err: unknown) => {
      if (err instanceof Error && err.message.includes("401")) router.push("/sign-in");
    },
  });

  const handleJoin = () => {
    if (!user) {
      router.push("/sign-in");
      return;
    }
    mutation.mutate();
  };

  return (
    <div>
      {/* ... community banner layout details ... */}
      <button onClick={handleJoin}>Join / Leave</button>
    </div>
  );
}
```

### 15.3. Moderator Pending Posts Queue (Moderator Queue)
*   **Source File:** [PendingPostsBanner.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/(board)/c/[slug]/PendingPostsBanner.tsx#L30-L84)
```typescript
  const handleModerate = async (postId: number, action: "APPROVE" | "REMOVE") => {
    setModeratingId(postId);
    try {
      await api(`/api/communities/${communityId}/posts/${postId}/moderate`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      if (action === "APPROVE") router.refresh();
    } catch {
      // ignore
    } finally {
      setModeratingId(null);
    }
  };
```

### 15.4. Technical Analysis
The Community interface implements server-rendered layouts paired with interactive membership mutations:
1.  **Session-Forwarding Server Fetch:** Next.js Server Components load the community config (`getCommunity`) on the server. By parsing cookies using `cookies()` and forwarding the JWT payload (`breadit_session`) in headers, the backend determines membership roles prior to rendering the DOM, preventing unauthorized content leak.
2.  **Optimistic State Updates:** In `CommunityHeader.tsx`, the Join/Leave trigger uses a React Query mutation (`useMutation`). Upon success, it fires `router.refresh()`, triggering Next.js to re-verify server components and update UI labels dynamically.
3.  **Role-Based Pending Queue (Moderator Queue):** If the user is flagged as an `OWNER` or `MOD`, the page injects the `PendingPostsBanner` component. This fetches pending community posts from `/api/communities/${id}/posts/pending` and exposes instant `Approve` or `Reject` buttons. Moderation actions execute asynchronously, filtering out moderated posts instantly from the list.

---

## 16. Flow 6: Administrative Console (/admin-console)

### 16.1. Administrative Layout (Role Check)
*   **Source File:** [layout.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/admin-console/layout.tsx#L6-L49)
```typescript
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  
  if (!session || session.user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="flex h-screen bg-black text-white">
      {/* Admin Sidebar Navigation */}
      <div className="w-64 border-r border-borderGray p-4 flex flex-col gap-6">
        <nav className="flex flex-col gap-2 flex-1">
          <Link href="/admin-console/users" className="p-3 rounded hover:bg-[#181818]">Manage Users</Link>
          <Link href="/admin-console/reports" className="p-3 rounded hover:bg-[#181818]">Reported Content</Link>
        </nav>
      </div>
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
    </div>
  );
}
```

### 16.2. User Management Console (Banning Dashboard)
*   **Source File:** [UserTable.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/admin-console/users/UserTable.tsx#L38-L113)
```typescript
  const handleBanToggle = async (user: AdminUserItem) => {
    setLoadingId(user.id);
    const endpoint = user.banned ? "unban" : "ban";
    const res = await api(`/api/admin/users/${user.id}/${endpoint}`, { method: "POST" });
    if (res.ok) {
      router.refresh();
    }
    setLoadingId(null);
  };
```

### 16.3. Report Resolution Queue (Report Queue)
*   **Source File:** [ReportTable.tsx](file:///d:/Fork/Breadit/apps/frontend/src/app/admin-console/reports/ReportTable.tsx#L26-L89)
```typescript
  const handleDismiss = async (id: number) => {
    setLoadingId(id);
    const res = await api(`/api/admin/reports/${id}/dismiss`, { method: "POST" });
    if (res.ok) router.refresh();
    setLoadingId(null);
  };

  const handleDeletePost = async (id: number) => {
    if (!confirm("Are you sure you want to delete this post?")) return;
    setLoadingId(id);
    const res = await api(`/api/admin/reports/${id}/delete-post`, { method: "DELETE" });
    if (res.ok) router.refresh();
    setLoadingId(null);
  };
```

### 16.4. Technical Analysis
The Admin Console provides global site moderation functions restricted to administrators:
1.  **Server-Side Role Guarding:** `layout.tsx` reads session details server-side. If the session is missing or the role claim is not equal to `"ADMIN"`, the router triggers a prompt redirect (`redirect("/")`) before rendering any administrative markup.
2.  **Global User Control (Ban/Unban):** The `UserTable` displays a list of accounts. The administrator can click the Ban/Unban toggle, which calls the global ban endpoint. Triggering `router.refresh()` refreshes the table rows with the latest status.
3.  **Content Report Resolution Queue (Report Queue):** The `ReportTable` displays reported posts. It provides two operations: Dismissal (`handleDismiss`) which flags the report as clean, and Delete Post (`handleDeletePost`) which removes the offending post from the system database.

