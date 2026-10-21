import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import type { Server, Socket } from 'socket.io';
import { BLACKLIST_PREFIX, verifyJwt } from '../auth/auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Set on `socket.data` by `authenticate`. The server decides who a socket is, never the client. */
type SocketUser = { id: string; username: string };

function userOf(socket: Socket): SocketUser | undefined {
  return socket.data?.user as SocketUser | undefined;
}

function conversationRoom(conversationId: unknown): { id: number; room: string } | null {
  const id = Number(conversationId);
  if (!Number.isInteger(id) || id < 1) return null;
  return { id, room: `conversation:${id}` };
}

/**
 * Real-time events. A socket is tied to the user in its login cookie when it connects:
 * - the server puts it in that user's room (named after the username), the client does not choose,
 * - it can join a conversation room only if it is a member of that conversation,
 * - typing events carry the username from the login, never the one the client sends.
 * This closes finding S1 (any socket could join any room and read another user's DMs).
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer() server: Server;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  afterInit(server: Server) {
    const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';
    const pubClient = new Redis(redisUrl);
    const subClient = pubClient.duplicate();
    server.adapter(createAdapter(pubClient, subClient));

    // Runs before the connection exists, so no event can arrive from an unknown socket.
    server.use((socket, next) => {
      this.authenticate(socket).then(
        () => next(),
        () => next(new Error('Unauthorized')),
      );
    });
  }

  /**
   * Checks the login cookie (and the logout blacklist, finding S5) and stores the user on the
   * socket. Throws if the cookie is missing, invalid, expired or logged out.
   */
  async authenticate(socket: Socket): Promise<void> {
    const cookieHeader = socket.handshake.headers.cookie ?? '';
    const match = /breadit_session=([^;]+)/.exec(cookieHeader);
    if (!match) throw new Error('No session cookie');

    const payload = await verifyJwt(decodeURIComponent(match[1]));
    const jti = payload['jti'] as string | undefined;
    if (jti && (await this.redis.get(`${BLACKLIST_PREFIX}:${jti}`))) {
      throw new Error('Session was logged out');
    }
    if (!payload.sub || typeof payload['username'] !== 'string') throw new Error('Bad token');

    socket.data.user = { id: String(payload.sub), username: payload['username'] } satisfies SocketUser;
  }

  async handleConnection(socket: Socket) {
    const user = userOf(socket);
    if (!user) {
      socket.disconnect();
      return;
    }
    await socket.join(user.username);
  }

  /**
   * Kept because the frontend still sends it after connecting. The value the client sends is
   * ignored: the socket only joins its own room, which it is already in.
   */
  @SubscribeMessage('newUser')
  async handleNewUser(@ConnectedSocket() socket: Socket) {
    const user = userOf(socket);
    if (user) await socket.join(user.username);
  }

  @SubscribeMessage('joinConversation')
  async handleJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() conversationId: number,
  ) {
    const user = userOf(socket);
    const target = conversationRoom(conversationId);
    if (!user || !target) return;

    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId: target.id, userId: user.id } },
      select: { userId: true },
    });
    if (member) await socket.join(target.room);
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() conversationId: number,
  ) {
    const target = conversationRoom(conversationId);
    if (target) socket.leave(target.room);
  }

  // fire-and-forget typing signals — no DB, just room broadcast
  @SubscribeMessage('startTyping')
  handleStartTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const user = userOf(socket);
    const target = conversationRoom(payload?.conversationId);
    // Only a socket that joined the room (so is a member) may speak into it.
    if (!user || !target || !socket.rooms.has(target.room)) return;
    socket
      .to(target.room)
      .emit('userTyping', { conversationId: target.id, username: user.username });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    const user = userOf(socket);
    const target = conversationRoom(payload?.conversationId);
    if (!user || !target || !socket.rooms.has(target.room)) return;
    socket.to(target.room).emit('userStopTyping', { conversationId: target.id });
  }
}
