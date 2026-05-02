import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const LIMIT = 10;

@Injectable()
export class HashtagsService {
  constructor(private readonly prisma: PrismaService) {}

  private postInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      _count: { select: { likes: true, rePosts: true, comments: true } },
      likes: userId ? { where: { userId }, select: { id: true } } : (false as const),
      rePosts: userId ? { where: { userId }, select: { id: true } } : (false as const),
      saves: userId ? { where: { userId }, select: { id: true } } : (false as const),
    };
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
