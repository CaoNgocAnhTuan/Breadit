import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CommunityRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BlockService } from '../block/block.service';
import { CacheService } from '../cache/cache.service';
import { UploadsService, type BufferedFile } from '../uploads/uploads.service';
import { NotificationsService } from '../notifications/notifications.service';

// Feed page size (posts per batch). Increase for better UX.
const LIMIT = 10;
const FOLLOW_GRAPH_TTL_SECONDS = 300;
const COMMUNITIES_GRAPH_TTL_SECONDS = 300;

type LegacyFeedPage = { posts: unknown[]; hasMore: boolean; nextCursor: number | null };
type CursorFeedPage = { posts: unknown[]; hasMore: boolean; nextCursor: string | null };

function isLegacyPageCursor(cursorRaw: string): boolean {
  return /^[0-9]+$/.test(cursorRaw) && cursorRaw !== '1';
}

function parseTimeCursor(cursorRaw: string): { createdAt: Date; id: number } | null {
  // format: "{createdAtMs}:{id}"
  if (!cursorRaw.includes(':')) return null;
  const [msStr, idStr] = cursorRaw.split(':', 2);
  const ms = Number(msStr);
  const id = Number(idStr);
  if (!Number.isFinite(ms) || !Number.isFinite(id)) return null;
  return { createdAt: new Date(ms), id };
}

function makeTimeCursor(item: { createdAt: Date; id: number }): string {
  return `${item.createdAt.getTime()}:${item.id}`;
}

function parseExploreCursor(cursorRaw: string): { scoreFixed: number; id: number } | null {
  // format: "{scoreFixed}:{id}"
  if (!cursorRaw.includes(':')) return null;
  const [scoreStr, idStr] = cursorRaw.split(':', 2);
  const scoreFixed = Number(scoreStr);
  const id = Number(idStr);
  if (!Number.isFinite(scoreFixed) || !Number.isFinite(id)) return null;
  return { scoreFixed, id };
}

function makeExploreCursor(item: { scoreFixed: number; id: number }): string {
  return `${item.scoreFixed}:${item.id}`;
}

function computeExploreScoreFixed(input: { likes: number; comments: number; reposts: number; ageHours: number }): number {
  // score = likes*1 + comments*2 + reposts*3 - ageHours*0.25
  const score = input.likes + input.comments * 2 + input.reposts * 3 - input.ageHours * 0.25;
  return Math.floor(score * 100);
}

function applyExploreDiversity<T extends { userId: string }>(
  candidates: T[],
  maxPerAuthorInWindow: number,
): T[] {
  if (maxPerAuthorInWindow <= 0) return candidates;
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const item of candidates) {
    const c = counts.get(item.userId) ?? 0;
    if (c >= maxPerAuthorInWindow) continue;
    counts.set(item.userId, c + 1);
    out.push(item);
  }
  return out;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly notificationsService: NotificationsService,
    private readonly blockService: BlockService,
    private readonly cache: CacheService,
  ) {}

  private mentionInclude() {
    return {
      select: {
        username: true,
        user: { select: { id: true, username: true, displayName: true, img: true } },
      },
    } as const;
  }

  private postInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      media: true,
      mentions: this.mentionInclude(),
      _count: { select: { likes: true, rePosts: true, comments: true } },
      likes: userId ? { where: { userId }, select: { id: true } } : (false as const),
      rePosts: userId ? { where: { userId }, select: { id: true } } : (false as const),
      saves: userId ? { where: { userId }, select: { id: true } } : (false as const),
    } as const;
  }

  private async getFolloweesIds(userId: string): Promise<string[]> {
    return this.cache.getOrSetJson(
      'graph:follows',
      [userId],
      FOLLOW_GRAPH_TTL_SECONDS,
      async () => {
        const followees = await this.prisma.follow.findMany({
          where: { followerId: userId },
          select: { followingId: true },
        });
        return followees.map((f) => f.followingId);
      },
    );
  }

  private async getCommunityIds(userId: string): Promise<number[]> {
    return this.cache.getOrSetJson(
      'graph:communities',
      [userId],
      COMMUNITIES_GRAPH_TTL_SECONDS,
      async () => {
        const memberships = await this.prisma.communityMember.findMany({
          where: { userId },
          select: { communityId: true },
        });
        return memberships.map((m) => m.communityId);
      },
    );
  }

  async findAll(cursorRaw: string, userParam?: string, userId?: string, feed?: string, communityId?: number) {
    const viewerKey = userId ?? 'guest';
    const version = userId ? await this.cache.getNumber('v:user', [userId], 0) : 0;
    const modeKey =
      communityId != null
        ? 'community'
        : userParam && userParam !== 'undefined'
          ? 'profile'
          : feed ?? 'home';
    const ttlSeconds = 10;

    // Cache key includes raw cursor to support both legacy page cursor and token cursor.
    const cached = await this.cache.getJson<LegacyFeedPage | CursorFeedPage>(
      'feed',
      [viewerKey, modeKey, userParam ?? '', communityId ?? 0, cursorRaw, version],
    );
    if (cached) return cached;

    const blockedIds = userId ? [...(await this.blockService.getAllBlockedPeerIds(userId))] : [];

    let whereCondition: any;
    let orderBy: object | object[] = [{ createdAt: 'desc' }, { id: 'desc' }];

    if (communityId) {
      whereCondition = {
        communityId,
        parentPostId: null,
        deletedAt: null,
        isApproved: true,
        ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
      };
    } else if (feed === 'explore') {
      whereCondition = {
        parentPostId: null,
        deletedAt: null,
        communityId: null, // Exclude community posts from main explore feed
        ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
      };
      // Explore ranking is handled separately below (Phase D).
      orderBy = [{ createdAt: 'desc' }, { id: 'desc' }];
    } else if (feed === 'following' && userId) {
      // Following feed: posts from followed users only (not self)
      const followingIds = await this.getFolloweesIds(userId);

      whereCondition = {
        parentPostId: null,
        deletedAt: null,
        communityId: null,
        userId: {
          in: followingIds,
          ...(blockedIds.length ? { notIn: blockedIds } : {}),
        },
      };
    } else if (feed === 'communities' && userId) {
      // Communities feed: posts from all communities user is a member of
      const communityIds = await this.getCommunityIds(userId);

      whereCondition = {
        parentPostId: null,
        deletedAt: null,
        isApproved: true,
        communityId: { in: communityIds },
        ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
      };
    } else if (userParam && userParam !== 'undefined') {
      whereCondition = { parentPostId: null, userId: userParam, deletedAt: null, communityId: null };
    } else if (userId) {
      const followees = await this.getFolloweesIds(userId);
      whereCondition = {
        parentPostId: null,
        deletedAt: null,
        communityId: null,
        userId: {
          in: [userId, ...followees],
          ...(blockedIds.length ? { notIn: blockedIds } : {}),
        },
      };
    } else {
      whereCondition = {
        parentPostId: null,
        deletedAt: null,
        communityId: null, // Exclude community posts from guest feed
        ...(blockedIds.length ? { userId: { notIn: blockedIds } } : {}),
      };
    }

    const include = this.postInclude(userId);

    // Explore (Phase D): time-decay + diversity + deterministic cursor.
    if (feed === 'explore') {
      // Keep legacy page-number behavior if client still sends cursor=2,3,... to avoid accidental breaking.
      if (isLegacyPageCursor(cursorRaw)) {
        const cursor = Number(cursorRaw);
        const posts = await this.prisma.post.findMany({
          where: whereCondition,
          include: {
            rePost: { include },
            ...include,
            community: { select: { name: true, slug: true } },
          },
          take: LIMIT,
          skip: (cursor - 1) * LIMIT,
          orderBy: [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
        });

        const totalPosts = await this.prisma.post.count({ where: whereCondition });
        const hasMore = cursor * LIMIT < totalPosts;
        const nextCursor = hasMore ? cursor + 1 : null;

        const result: LegacyFeedPage = { posts, hasMore, nextCursor };
        await this.cache.setJson(
          'feed',
          [viewerKey, modeKey, userParam ?? '', communityId ?? 0, cursorRaw, version],
          result,
          ttlSeconds,
        );
        return result;
      }

      const exploreCursor = parseExploreCursor(cursorRaw);
      const cursorFilter = exploreCursor
        ? { scoreFixedLt: exploreCursor.scoreFixed, idLt: exploreCursor.id }
        : null;

      const RECENT_DAYS = 7;
      const CANDIDATE_TAKE = 400;
      const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);

      const rows = await this.prisma.post.findMany({
        where: { ...whereCondition, createdAt: { gte: since } },
        include: {
          rePost: { include },
          ...include,
          community: { select: { name: true, slug: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: CANDIDATE_TAKE,
      });

      const now = Date.now();
      const scored = rows
        .map((p: any) => {
          const createdAtMs = new Date(p.createdAt).getTime();
          const ageHours = Math.max(0, (now - createdAtMs) / (1000 * 60 * 60));
          const likes = p?._count?.likes ?? 0;
          const comments = p?._count?.comments ?? 0;
          const reposts = p?._count?.rePosts ?? 0;
          const scoreFixed = computeExploreScoreFixed({ likes, comments, reposts, ageHours });
          return { post: p, scoreFixed, id: p.id as number, userId: p.userId as string };
        })
        .sort((a, b) => (b.scoreFixed - a.scoreFixed) || (b.id - a.id));

      const diversified = applyExploreDiversity(scored, 3);

      const afterCursor = cursorFilter
        ? diversified.filter((x) => x.scoreFixed < cursorFilter.scoreFixedLt || (x.scoreFixed === cursorFilter.scoreFixedLt && x.id < cursorFilter.idLt))
        : diversified;

      const page = afterCursor.slice(0, LIMIT + 1);
      const hasMore = page.length > LIMIT;
      const items = hasMore ? page.slice(0, LIMIT) : page;
      const posts = items.map((x) => x.post);
      const nextCursor = hasMore && items.length > 0 ? makeExploreCursor(items[items.length - 1]) : null;

      const result: CursorFeedPage = { posts, hasMore, nextCursor };
      await this.cache.setJson(
        'feed',
        [viewerKey, modeKey, userParam ?? '', communityId ?? 0, cursorRaw, version],
        result,
        ttlSeconds,
      );
      return result;
    }

    // Legacy support (page-number cursor) for clients still sending cursor=2,3,...
    if (isLegacyPageCursor(cursorRaw)) {
      const cursor = Number(cursorRaw);
      const posts = await this.prisma.post.findMany({
        where: whereCondition,
        include: {
          rePost: { include },
          ...include,
          community: { select: { name: true, slug: true } },
        },
        take: LIMIT,
        skip: (cursor - 1) * LIMIT,
        orderBy,
      });

      const totalPosts = await this.prisma.post.count({ where: whereCondition });
      const hasMore = cursor * LIMIT < totalPosts;
      const nextCursor = hasMore ? cursor + 1 : null;

      const result: LegacyFeedPage = { posts, hasMore, nextCursor };
      await this.cache.setJson(
        'feed',
        [viewerKey, modeKey, userParam ?? '', communityId ?? 0, cursorRaw, version],
        result,
        ttlSeconds,
      );
      return result;
    }

    // Cursor-based pagination for time-ordered feeds (non-explore).
    const timeCursor = parseTimeCursor(cursorRaw);
    const cursorWhere = timeCursor
      ? {
          OR: [
            { createdAt: { lt: timeCursor.createdAt } },
            { createdAt: timeCursor.createdAt, id: { lt: timeCursor.id } },
          ],
        }
      : {};

    const rows = await this.prisma.post.findMany({
      where: { ...whereCondition, ...cursorWhere },
      include: {
        rePost: { include },
        ...include,
        community: { select: { name: true, slug: true } },
      },
      take: LIMIT + 1,
      orderBy,
    });

    const hasMore = rows.length > LIMIT;
    const posts = hasMore ? rows.slice(0, LIMIT) : rows;
    const nextCursor =
      hasMore && posts.length > 0
        ? makeTimeCursor({
            createdAt: (posts[posts.length - 1] as any).createdAt,
            id: (posts[posts.length - 1] as any).id,
          })
        : null;

    const result: CursorFeedPage = { posts, hasMore, nextCursor };
    await this.cache.setJson(
      'feed',
      [viewerKey, modeKey, userParam ?? '', communityId ?? 0, cursorRaw, version],
      result,
      ttlSeconds,
    );
    return result;
  }

  async findOne(postId: number, userId?: string) {
    const include = this.postInclude(userId);
    const post = await this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: {
        ...include,
        community: { select: { name: true, slug: true } },
      },
    });
    if (
      post &&
      userId &&
      post.userId !== userId &&
      (await this.blockService.isBlockedPair(userId, post.userId))
    ) {
      return null;
    }
    return post;
  }

  async create(
    userId: string,
    body: {
      desc?: string;
      imgType?: string;
      rePostId?: number;
      isSensitive?: boolean;
      communityId?: number;
    },
    files: BufferedFile[] = [],
  ) {
    let communityMembership: { role: CommunityRole } | null = null;
    if (body.communityId) {
      const community = await this.prisma.community.findUnique({ where: { id: body.communityId } });
      if (!community) throw new BadRequestException('Community not found');

      const banned = await this.prisma.communityBannedUser.findUnique({
        where: { userId_communityId: { userId, communityId: body.communityId } },
      });
      if (banned) throw new ForbiddenException('You are banned from this community');

      communityMembership = await this.prisma.communityMember.findUnique({
        where: { userId_communityId: { userId, communityId: body.communityId } },
        select: { role: true },
      });
    }

    const uploadedMedia: { url: string; type: string }[] = [];

    for (const file of files) {
      const url = await this.uploadsService.saveFile(file, body.imgType);
      const type = this.uploadsService.isVideo(file) ? 'VIDEO' : 'IMAGE';
      uploadedMedia.push({ url, type });
    }

    const include = this.postInclude(userId);
    const post = await this.prisma.post.create({
      data: {
        desc: body.desc,
        rePostId: body.rePostId ?? null,
        isSensitive: body.isSensitive ?? false,
        communityId: body.communityId ?? null,
        isApproved: body.communityId
          ? communityMembership?.role === 'OWNER' || communityMembership?.role === 'MOD'
          : true,
        userId,
        media: {
          create: uploadedMedia.map((m) => ({
            url: m.url,
            type: m.type,
          })),
        },
      },
      include: {
        rePost: { include },
        ...include,
        community: { select: { name: true, slug: true } },
      },
    });

    if (body.desc) {
      const tags = [
        ...new Set(
          [...body.desc.matchAll(/#([a-zA-Z0-9_]+)/g)].map((m) =>
            m[1].toLowerCase(),
          ),
        ),
      ];
      if (tags.length > 0) {
        await Promise.all(
          tags.map((tag) =>
            this.prisma.hashtag
              .upsert({ where: { tag }, create: { tag }, update: {} })
              .then((ht) =>
                this.prisma.postTag.upsert({
                  where: { postId_hashtagId: { postId: post.id, hashtagId: ht.id } },
                  create: { postId: post.id, hashtagId: ht.id },
                  update: {},
                }),
              ),
          ),
        );
      }

      const mentionUsernames = [
        ...new Set(
          [...body.desc.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
        ),
      ];
      if (mentionUsernames.length > 0) {
        const followingIds = (
          await this.prisma.follow.findMany({
            where: { followerId: userId },
            select: { followingId: true },
          })
        ).map((f) => f.followingId);

        const mentionedUsers = await this.prisma.user.findMany({
          where: {
            username: { in: mentionUsernames },
            id: { in: followingIds },
          },
          select: { id: true, username: true },
        });

        if (mentionedUsers.length > 0) {
          await this.prisma.mention.createMany({
            data: mentionedUsers.map((u) => ({
              postId: post.id,
              userId: u.id,
              username: u.username,
            })),
          });
          void Promise.all(
            mentionedUsers.map((u) =>
              this.notificationsService.emit('MENTION', userId, u.id, post.id),
            ),
          );
        }
      }
    }

    if (body.communityId) {
      const isStaff =
        communityMembership?.role === CommunityRole.OWNER ||
        communityMembership?.role === CommunityRole.MOD;

      const allMembers = await this.prisma.communityMember.findMany({
        where: { communityId: body.communityId },
        select: { userId: true, role: true },
      });

      if (isStaff) {
        // Auto-approved: notify all members except the poster
        void Promise.all(
          allMembers
            .filter((m) => m.userId !== userId)
            .map((m) => this.notificationsService.emit('COMMUNITY_NEW_POST', userId, m.userId, post.id)),
        );
      } else {
        // Pending approval: notify owners and mods
        void Promise.all(
          allMembers
            .filter((m) => m.role === CommunityRole.OWNER || m.role === CommunityRole.MOD)
            .map((m) => this.notificationsService.emit('COMMUNITY_POST', userId, m.userId, post.id)),
        );
      }
    }

    return post;
  }

  async update(
    postId: number,
    userId: string,
    body: { desc?: string; mediaIdsToRemove?: number[] },
    files: BufferedFile[] = [],
  ) {
    const existing = await this.prisma.post.findUnique({
      where: { id: postId },
      include: { media: true },
    });
    if (!existing || existing.deletedAt) throw new NotFoundException();
    if (existing.userId !== userId) throw new ForbiddenException();

    const mediaIdsToRemove = body.mediaIdsToRemove ?? [];
    const mediaToRemove = mediaIdsToRemove.length
      ? existing.media.filter((m) => mediaIdsToRemove.includes(m.id))
      : [];

    for (const m of mediaToRemove) {
      await this.uploadsService.deleteFile(m.url);
    }

    const uploadedMedia: { url: string; type: string }[] = [];
    for (const file of files) {
      const url = await this.uploadsService.saveFile(file);
      const type = this.uploadsService.isVideo(file) ? 'VIDEO' : 'IMAGE';
      uploadedMedia.push({ url, type });
    }

    if (body.desc !== undefined) {
      const tags = [
        ...new Set(
          [...body.desc.matchAll(/#([a-zA-Z0-9_]+)/g)].map((m) =>
            m[1].toLowerCase(),
          ),
        ),
      ];

      const mentionUsernames = [
        ...new Set(
          [...body.desc.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
        ),
      ];

      await this.prisma.$transaction(async (tx) => {
        if (mediaIdsToRemove.length) {
          await tx.postMedia.deleteMany({
            where: { id: { in: mediaIdsToRemove }, postId },
          });
        }

        if (uploadedMedia.length) {
          await tx.postMedia.createMany({
            data: uploadedMedia.map((m) => ({ postId, url: m.url, type: m.type })),
          });
        }

        await tx.post.update({
          where: { id: postId },
          data: { desc: body.desc },
        });

        await tx.postTag.deleteMany({ where: { postId } });
        if (tags.length > 0) {
          for (const tag of tags) {
            const ht = await tx.hashtag.upsert({
              where: { tag },
              create: { tag },
              update: {},
            });
            await tx.postTag.upsert({
              where: { postId_hashtagId: { postId, hashtagId: ht.id } },
              create: { postId, hashtagId: ht.id },
              update: {},
            });
          }
        }

        await tx.mention.deleteMany({ where: { postId } });
        if (mentionUsernames.length > 0) {
          const followingIds = (
            await tx.follow.findMany({
              where: { followerId: userId },
              select: { followingId: true },
            })
          ).map((f) => f.followingId);

          const mentionedUsers = await tx.user.findMany({
            where: {
              username: { in: mentionUsernames },
              id: { in: followingIds },
            },
            select: { id: true, username: true },
          });

          if (mentionedUsers.length > 0) {
            await tx.mention.createMany({
              data: mentionedUsers.map((u) => ({
                postId,
                userId: u.id,
                username: u.username,
              })),
            });
          }
        }
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        if (mediaIdsToRemove.length) {
          await tx.postMedia.deleteMany({
            where: { id: { in: mediaIdsToRemove }, postId },
          });
        }

        if (uploadedMedia.length) {
          await tx.postMedia.createMany({
            data: uploadedMedia.map((m) => ({ postId, url: m.url, type: m.type })),
          });
        }
      });
    }

    return this.findOne(postId, userId);
  }

  async createReport(reporterId: string, postId: number, reason: string) {
    const report = await this.prisma.report.create({
      data: { reporterId, postId, reason, status: 'OPEN' },
    });

    // Notify all admins
    const admins = await this.prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    for (const admin of admins) {
      await this.notificationsService.emit('REPORT', reporterId, admin.id, postId);
    }

    return report;
  }



  async remove(postId: number, userId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException();
    if (post.userId !== userId) throw new ForbiddenException();
    await this.prisma.post.update({
      where: { id: postId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }
}
