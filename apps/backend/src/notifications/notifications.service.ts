import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { BlockService } from '../block/block.service';
import { CacheService } from '../cache/cache.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly blockService: BlockService,
    private readonly cache: CacheService,
  ) {}

  async emit(
    type: NotificationType,
    actorId: string,
    recipientId: string,
    postId?: number,
  ) {
    if (actorId === recipientId) return;

    const notification = await this.prisma.notification.create({
      data: { type, actorId, recipientId, postId: postId ?? null },
      include: {
        actor: { select: { id: true, username: true, displayName: true, img: true } },
        post: { select: { id: true, user: { select: { username: true } } } },
      },
    });

    const recipient = await this.prisma.user.findUnique({
      where: { id: recipientId },
      select: { username: true },
    });

    if (recipient) {
      this.gateway.server.to(recipient.username).emit('getNotification', notification);
    }

    return notification;
  }

  async findAll(userId: string, cursor = 1, unread = false) {
    const PAGE_SIZE = 20;
    const skip = (cursor - 1) * PAGE_SIZE;

    const version = await this.cache.getNumber('v:user', [userId], 0);
    const ttlSeconds = 10;
    const cached = await this.cache.getJson<{
      items: unknown[];
      nextCursor: number | null;
      total: number;
    }>('notifications', [userId, cursor, unread, version]);
    if (cached) return cached;

    const blockedIds = [...(await this.blockService.getAllBlockedPeerIds(userId))];

    const where = {
      recipientId: userId,
      ...(unread ? { readAt: null } : {}),
      ...(blockedIds.length ? { actorId: { notIn: blockedIds } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: PAGE_SIZE,
        include: {
          actor: { select: { id: true, username: true, displayName: true, img: true } },
          post: { select: { id: true, user: { select: { username: true } } } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);

    const result = {
      items,
      nextCursor: skip + items.length < total ? cursor + 1 : null,
      total,
    };
    await this.cache.setJson('notifications', [userId, cursor, unread, version], result, ttlSeconds);
    return result;
  }

  async markRead(userId: string, notifId: number) {
    await this.prisma.notification.updateMany({
      where: { id: notifId, recipientId: userId },
      data: { readAt: new Date() },
    });
    await this.cache.incrNumber('v:user', [userId]);
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    await this.cache.incrNumber('v:user', [userId]);
    return { count: result.count };
  }
}
