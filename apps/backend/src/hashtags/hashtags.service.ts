import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { engagementSelect } from '../posts/engagement';

const LIMIT = 10;
const TRENDING_TTL_SECONDS = 60;

@Injectable()
export class HashtagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private postInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      mentions: {
        select: {
          username: true,
          user: { select: { id: true, username: true, displayName: true, img: true } },
        },
      },
      ...engagementSelect(userId),
    };
  }

  /**
   * The top 5 tags by live posts (B7): not deleted, not in a community, approved. Quote reposts count,
   * their tags come from their own text. The list is cached for 60 s with no version key: a trending
   * list that is up to one minute old is fine.
   */
  async getTrending() {
    return this.cache.getOrSetJson('hashtags:trending', ['top5'], TRENDING_TTL_SECONDS, async () => {
      const tags = await this.prisma.postTag.groupBy({
        by: ['hashtagId'],
        where: { post: { deletedAt: null, communityId: null, isApproved: true } },
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
    });
  }

  async getPostsByTag(tag: string, cursor: number, userId?: string) {
    const normalized = tag.toLowerCase();
    const include = this.postInclude(userId);
    const posts = await this.prisma.post.findMany({
      where: {
        deletedAt: null,
        parentPostId: null,
        communityId: null,
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
        parentPostId: null,
        communityId: null,
        tags: { some: { hashtag: { tag: normalized } } },
      },
    });
    const hasMore = cursor * LIMIT < total;
    const nextCursor = hasMore ? cursor + 1 : null;
    return { posts, hasMore, nextCursor, tag: normalized };
  }
}
