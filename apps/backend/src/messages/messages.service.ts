import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { BlockService } from '../block/block.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { CreateConversationDto, CreateMessageDto } from './dto/create-message.dto';

const MEMBER_SELECT = {
  id: true,
  username: true,
  displayName: true,
  img: true,
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationsGateway,
    private readonly blockService: BlockService,
    private readonly cache: CacheService,
  ) {}

  async searchConversations(userId: string, q: string) {
    const term = (q ?? '').trim();
    if (!term) return { users: [], messages: [] };

    const blockedPeers = await this.blockService.getAllBlockedPeerIds(userId);

    const memberships = await this.prisma.conversationMember.findMany({
      where: { userId },
      select: { conversationId: true },
      take: 500,
    });
    const convIds = memberships.map((m) => m.conversationId);
    if (convIds.length === 0) return { users: [], messages: [] };

    const [userRows, messageRows] = await Promise.all([
      this.prisma.conversationMember.findMany({
        where: {
          conversationId: { in: convIds },
          userId: { not: userId },
          user: {
            OR: [
              { username: { contains: term, mode: 'insensitive' } },
              { displayName: { contains: term, mode: 'insensitive' } },
            ],
          },
        },
        select: {
          conversationId: true,
          user: { select: MEMBER_SELECT },
        },
        take: 10,
      }),
      this.prisma.message.findMany({
        where: {
          conversationId: { in: convIds },
          body: { contains: term, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
          conversation: {
            select: {
              id: true,
              members: { include: { user: { select: MEMBER_SELECT } } },
            },
          },
        },
      }),
    ]);

    const users = userRows
      .filter((r) => !blockedPeers.has(r.user.id))
      .map((r) => ({
        conversationId: r.conversationId,
        otherMember: r.user,
      }));

    const messages = messageRows
      .filter((m) => {
        const otherMember =
          m.conversation.members.find((mem) => mem.userId !== userId)?.user ??
          null;
        return otherMember && !blockedPeers.has(otherMember.id);
      })
      .map((m) => {
        const otherMember =
          m.conversation.members.find((mem) => mem.userId !== userId)?.user ??
          { id: '', username: '[deleted]', displayName: null, img: null };

        return {
          conversationId: m.conversationId,
          otherMember,
          message: {
            id: m.id,
            body: m.body,
            mediaUrl: m.mediaUrl,
            senderId: m.senderId,
            createdAt: m.createdAt,
          },
        };
      });

    return { users, messages };
  }

  async getConversations(userId: string, cursor?: number) {
    const blockedPeers = await this.blockService.getAllBlockedPeerIds(userId);

    const where: Record<string, unknown> = {
      members: { some: { userId } },
    };

    if (blockedPeers.size > 0) {
      const peerList = [...blockedPeers];
      const blockedMemberRows = await this.prisma.conversationMember.findMany({
        where: { userId: { in: peerList } },
        select: { conversationId: true },
      });
      const excludeIds = [...new Set(blockedMemberRows.map((r) => r.conversationId))];
      if (excludeIds.length) {
        where['id'] = { notIn: excludeIds };
      }
    }

    if (cursor) {
      const pivot = await this.prisma.conversation.findUnique({
        where: { id: cursor },
        select: { updatedAt: true },
      });
      if (pivot) {
        where['updatedAt'] = { lt: pivot.updatedAt };
      }
    }

    const conversations = await this.prisma.conversation.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        members: { include: { user: { select: MEMBER_SELECT } } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    const items = await Promise.all(
      conversations.map(async (conv) => {
        const myMember = conv.members.find((m) => m.userId === userId)!;
        const otherMember = conv.members.find((m) => m.userId !== userId);

        const cachedUnread = await this.cache.getJson<number>('dm:unreadCount', [conv.id, userId]);
        const unreadCount =
          cachedUnread ?? (await this.prisma.message.count({
            where: {
              conversationId: conv.id,
              senderId: { not: userId },
              createdAt: { gt: myMember.lastReadAt },
            },
          }));

        if (cachedUnread === null) {
          await this.cache.setJson('dm:unreadCount', [conv.id, userId], unreadCount, 60);
        }

        const lastMsg = conv.messages[0] ?? null;

        return {
          id: conv.id,
          updatedAt: conv.updatedAt,
          otherMember: otherMember
            ? otherMember.user
            : { id: '', username: '[deleted]', displayName: null, img: null },
          lastMessage: lastMsg
            ? {
                id: lastMsg.id,
                body: lastMsg.body,
                mediaUrl: lastMsg.mediaUrl,
                senderId: lastMsg.senderId,
                createdAt: lastMsg.createdAt,
              }
            : null,
          unreadCount,
        };
      }),
    );

    const nextCursor =
      conversations.length === 20
        ? conversations[conversations.length - 1].id
        : null;

    return { items, nextCursor };
  }

  async findOrCreateConversation(userId: string, dto: CreateConversationDto) {
    const { targetUserId } = dto;
    if (userId === targetUserId) {
      throw new ForbiddenException('Cannot message yourself');
    }

    await this.blockService.assertNotBlockedPair(userId, targetUserId);

    const existing = await this.prisma.conversation.findFirst({
      where: {
        AND: [
          { members: { some: { userId } } },
          { members: { some: { userId: targetUserId } } },
        ],
      },
    });
    if (existing) return existing;

    return this.prisma.conversation.create({
      data: {
        members: {
          create: [{ userId }, { userId: targetUserId }],
        },
      },
    });
  }

  async getConversationById(conversationId: number, userId: string) {
    await this.assertMember(conversationId, userId);
    await this.assertConversationNotBlocked(conversationId, userId);
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: { members: { include: { user: { select: MEMBER_SELECT } } } },
    });
    if (!conv) throw new NotFoundException('Conversation not found');
    const otherMember = conv.members.find((m) => m.userId !== userId);
    return {
      id: conv.id,
      otherMember: otherMember
        ? { ...otherMember.user, lastReadAt: otherMember.lastReadAt }
        : {
            id: '',
            username: '[deleted]',
            displayName: null,
            img: null,
            lastReadAt: null,
          },
    };
  }

  async getMessages(conversationId: number, userId: string, cursor?: number) {
    await this.assertMember(conversationId, userId);
    await this.assertConversationNotBlocked(conversationId, userId);

    const messages = await this.prisma.message.findMany({
      where: {
        conversationId,
        ...(cursor ? { id: { lt: cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: 30,
    });

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    const items = messages.reverse();
    const nextCursor = messages.length === 30 ? messages[messages.length - 1].id : null;

    return { items, nextCursor };
  }

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

  async markRead(conversationId: number, userId: string) {
    await this.assertMember(conversationId, userId);
    await this.assertConversationNotBlocked(conversationId, userId);

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    // Reader unread count for this conversation becomes 0.
    await this.cache.del('dm:unreadCount', [conversationId, userId]);

    const otherMember = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: userId } },
      include: { user: { select: { username: true } } },
    });

    if (otherMember?.user) {
      this.gateway.server
        ?.to(otherMember.user.username)
        .emit('messageRead', { conversationId, readerId: userId });
    }
  }

  async getUnreadCount(userId: string) {
    const blockedPeers = await this.blockService.getAllBlockedPeerIds(userId);
    let excludeConvIds: number[] = [];
    if (blockedPeers.size > 0) {
      const rows = await this.prisma.conversationMember.findMany({
        where: { userId: { in: [...blockedPeers] } },
        select: { conversationId: true },
      });
      excludeConvIds = [...new Set(rows.map((r) => r.conversationId))];
    }

    const members = await this.prisma.conversationMember.findMany({
      where: {
        userId,
        ...(excludeConvIds.length > 0
          ? { conversationId: { notIn: excludeConvIds } }
          : {}),
      },
      select: { conversationId: true, lastReadAt: true },
    });

    let count = 0;
    for (const m of members) {
      const hasUnread = await this.prisma.message.findFirst({
        where: {
          conversationId: m.conversationId,
          senderId: { not: userId },
          createdAt: { gt: m.lastReadAt },
        },
        select: { id: true },
      });
      if (hasUnread) count++;
    }

    return { count };
  }

  private async assertConversationNotBlocked(conversationId: number, userId: string) {
    const other = await this.prisma.conversationMember.findFirst({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    });
    if (other) await this.blockService.assertNotBlockedPair(userId, other.userId);
  }

  private async assertMember(conversationId: number, userId: string) {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this conversation');
    return member;
  }
}
