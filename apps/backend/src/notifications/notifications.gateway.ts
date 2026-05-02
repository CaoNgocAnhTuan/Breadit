import { randomUUID } from 'crypto';
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
import { verifyJwt } from '../auth/auth.service';

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

  @SubscribeMessage('sendNotification')
  handleSendNotification(
    @MessageBody()
    payload: { receiverUsername: string; data: Record<string, unknown> },
  ) {
    this.server.to(payload.receiverUsername).emit('getNotification', {
      id: randomUUID(),
      ...payload.data,
    });
  }

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() conversationId: number,
  ) {
    socket.join(`conversation:${conversationId}`);
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() socket: Socket,
    @MessageBody() conversationId: number,
  ) {
    socket.leave(`conversation:${conversationId}`);
  }

  // fire-and-forget typing signals — no DB, just room broadcast
  @SubscribeMessage('startTyping')
  handleStartTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: number; username: string },
  ) {
    socket
      .to(`conversation:${payload.conversationId}`)
      .emit('userTyping', { conversationId: payload.conversationId, username: payload.username });
  }

  @SubscribeMessage('stopTyping')
  handleStopTyping(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: { conversationId: number },
  ) {
    socket
      .to(`conversation:${payload.conversationId}`)
      .emit('userStopTyping', { conversationId: payload.conversationId });
  }
}
