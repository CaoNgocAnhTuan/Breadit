import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BlockService } from '../block/block.service';
import { CacheService } from '../cache/cache.service';

const RESULT_LIMIT = 5;

@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockService: BlockService,
    private readonly cache: CacheService,
  ) {}

  async search(q: string, userId?: string) {
    if (!q || q.trim().length === 0) {
      return { posts: [], users: [], hashtags: [] };
    }

    const term = q.trim();
    const viewerKey = userId ?? 'guest';
    const normalized = term.toLowerCase();
    const version = userId ? await this.cache.getNumber('v:user', [userId], 0) : 0;
    const ttlSeconds = 10;

    const cached = await this.cache.getJson<{
      posts: unknown[];
      users: unknown[];
      hashtags: unknown[];
      communities: unknown[];
    }>('search', [viewerKey, normalized, version]);
    if (cached) return cached;

    const blockedIds = userId ? [...(await this.blockService.getAllBlockedPeerIds(userId))] : [];

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
        where: { tag: { contains: normalized, mode: 'insensitive' } },
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

    const result = { posts, users, hashtags, communities };
    await this.cache.setJson('search', [viewerKey, normalized, version], result, ttlSeconds);
    return result;
  }
}
