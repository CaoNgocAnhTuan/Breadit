import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { POST_DESC_MAX, isTooLong } from '../common/limits';

@Injectable()
export class InteractionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /** The post must exist and not be soft-deleted. Returns its author id. */
  private async assertPostLive(postId: number): Promise<{ userId: string }> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { userId: true },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  async toggleLike(userId: string, postId: number) {
    const post = await this.assertPostLive(postId);
    const existing = await this.prisma.like.findFirst({ where: { userId, postId } });

    if (existing) {
      await this.prisma.like.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.like.create({ data: { userId, postId } });
      void this.notificationsService.emit('LIKE', userId, post.userId, postId);
    }

    const count = await this.prisma.like.count({ where: { postId } });
    return { liked: !existing, count };
  }

  async toggleSave(userId: string, postId: number) {
    await this.assertPostLive(postId);
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
    // Text that is only spaces is a plain repost, not a quote.
    const quote = desc && desc.trim() ? desc : undefined;
    if (isTooLong(quote, POST_DESC_MAX)) {
      throw new BadRequestException(`Text is too long (max ${POST_DESC_MAX} characters)`);
    }
    const originalPost = await this.assertPostLive(postId);

    if (quote) {
      await this.prisma.post.create({
        data: { userId, rePostId: postId, desc: quote },
      });
      void this.notificationsService.emit('REPOST', userId, originalPost.userId, postId);
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
      void this.notificationsService.emit('REPOST', userId, originalPost.userId, postId);
    }

    const count = await this.prisma.post.count({
      where: { rePostId: postId, deletedAt: null },
    });
    return { reposted: !existing, count };
  }
}
