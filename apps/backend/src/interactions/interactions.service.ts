import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class InteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async toggleLike(userId: string, postId: number) {
    const [post, existing] = await Promise.all([
      this.prisma.post.findUnique({ where: { id: postId }, select: { userId: true } }),
      this.prisma.like.findFirst({ where: { userId, postId } }),
    ]);

    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.like.create({ data: { userId, postId } });
      if (post) {
        void this.notificationsService.emit('LIKE', userId, post.userId, postId);
      }
    }

    const count = await this.prisma.like.count({ where: { postId } });
    return { liked: !existing, count };
  }

  async toggleSave(userId: string, postId: number) {
    const existing = await this.prisma.savedPosts.findFirst({
      where: { userId, postId },
    });

    if (existing) {
      await this.prisma.savedPosts.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.savedPosts.create({ data: { userId, postId } });
    }

    return { saved: !existing };
  }

  async toggleRepost(userId: string, postId: number, desc?: string) {
    const originalPost = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { userId: true },
    });

    if (desc) {
      await this.prisma.post.create({
        data: { userId, rePostId: postId, desc },
      });
      if (originalPost) {
        void this.notificationsService.emit('REPOST', userId, originalPost.userId, postId);
      }
      const count = await this.prisma.post.count({
        where: { rePostId: postId, deletedAt: null },
      });
      return { reposted: true, count };
    }

    const existing = await this.prisma.post.findFirst({
      where: { userId, rePostId: postId, desc: null, parentPostId: null, deletedAt: null },
    });

    if (existing) {
      await this.prisma.post.update({
        where: { id: existing.id },
        data: { deletedAt: new Date() },
      });
    } else {
      await this.prisma.post.create({ data: { userId, rePostId: postId } });
      if (originalPost) {
        void this.notificationsService.emit('REPOST', userId, originalPost.userId, postId);
      }
    }

    const count = await this.prisma.post.count({
      where: { rePostId: postId, deletedAt: null },
    });
    return { reposted: !existing, count };
  }
}
