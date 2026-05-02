import { Injectable } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
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

    const blockRows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      select: { blockerId: true, blockedId: true },
    });
    const blockedIds = blockRows
      .flatMap((r) => [r.blockerId, r.blockedId])
      .filter((id) => id !== userId);

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

    return {
      items,
      nextCursor: skip + items.length < total ? cursor + 1 : null,
      total,
    };
  }

  async markRead(userId: string, notifId: number) {
    await this.prisma.notification.updateMany({
      where: { id: notifId, recipientId: userId },
      data: { readAt: new Date() },
    });
    return { ok: true };
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId: userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { count: result.count };
  }
}
