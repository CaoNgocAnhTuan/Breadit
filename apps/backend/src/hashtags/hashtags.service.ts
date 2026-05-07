import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LIMIT = 10;

@Injectable()
export class HashtagsService {
  constructor(private readonly prisma: PrismaService) {}

  private postInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      mentions: {
        select: {
          username: true,
          user: { select: { id: true, username: true, displayName: true, img: true } },
        },
      },
      _count: { select: { likes: true, rePosts: true, comments: true } },
      likes: userId ? { where: { userId }, select: { id: true } } : (false as const),
      rePosts: userId ? { where: { userId }, select: { id: true } } : (false as const),
      saves: userId ? { where: { userId }, select: { id: true } } : (false as const),
    };
  }

  async getTrending() {
    const tags = await this.prisma.postTag.groupBy({
      by: ['hashtagId'],
      _count: { postId: true },
      orderBy: { _count: { postId: 'desc' } },
      take: 5,
    });

    if (tags.length === 0) return [];

    const hashtags = await this.prisma.hashtag.findMany({
      where: { id: { in: tags.map((t) => t.hashtagId) } },
      select: { id: true, tag: true },
    });

    return tags.map((t) => {
      const ht = hashtags.find((h) => h.id === t.hashtagId);
      return { tag: ht?.tag ?? '', postCount: t._count.postId };
    });
  }

  async getPostsByTag(tag: string, cursor: number, userId?: string) {
    const normalized = tag.toLowerCase();
    const include = this.postInclude(userId);
    const posts = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        tags: { some: { hashtag: { tag: normalized } } },
      },
      include: { rePost: { include }, ...include },
      take: LIMIT,
      skip: (cursor - 1) * LIMIT,
      orderBy: { createdAt: 'desc' },
    });
    const total = await this.prisma.post.count({
      where: {
        deletedAt: null,
        tags: { some: { hashtag: { tag: normalized } } },
      },
    });
    return { posts, hasMore: cursor * LIMIT < total, tag: normalized };
  }
}
