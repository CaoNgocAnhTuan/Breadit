import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const RESULT_LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async search(q: string, userId?: string) {
    if (!q || q.trim().length === 0) {
      return { posts: [], users: [], hashtags: [] };
    }

    const term = q.trim();

    let blockedIds: string[] = [];
    if (userId) {
      const rows = await this.prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      });
      blockedIds = rows
        .flatMap((r) => [r.blockerId, r.blockedId])
        .filter((id) => id !== userId);
    }

    const [posts, users, hashtags, communities] = await Promise.all([
      this.prisma.post.findMany({
        where: {
          deletedAt: null,
          parentPostId: null,
          communityId: null,
          desc: { contains: term, mode: 'insensitive' },
          ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
        },
        include: {
          user: { select: { displayName: true, username: true, img: true } },
          _count: { select: { likes: true, rePosts: true, comments: true } },
          likes: userId ? { where: { userId }, select: { id: true } } : (false as const),
          rePosts: userId ? { where: { userId }, select: { id: true } } : (false as const),
          saves: userId ? { where: { userId }, select: { id: true } } : (false as const),
          community: { select: { name: true, slug: true } },
        },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: {
          OR: [
            { username: { contains: term, mode: 'insensitive' } },
            { displayName: { contains: term, mode: 'insensitive' } },
          ],
          ...(blockedIds.length ? { id: { notIn: blockedIds } } : {}),
        },
        select: { id: true, username: true, displayName: true, img: true },
        take: RESULT_LIMIT,
      }),
      this.prisma.hashtag.findMany({
        where: { tag: { contains: term.toLowerCase(), mode: 'insensitive' } },
        select: { id: true, tag: true },
        take: RESULT_LIMIT,
      }),
      this.prisma.community.findMany({
        where: {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            { slug: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: { id: true, name: true, slug: true, img: true },
        take: RESULT_LIMIT,
      }),
    ]);

    return { posts, users, hashtags, communities };
  }
}
