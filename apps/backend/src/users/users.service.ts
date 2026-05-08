import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { BlockService } from '../block/block.service';
import { CacheService } from '../cache/cache.service';
import { UpdateUserDto } from './dto/update-user.dto';

const POST_LIMIT = 3;
const USER_LIMIT = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly blockService: BlockService,
    private readonly cache: CacheService,
  ) {}

  private postInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      media: true,
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

  async findByUsername(username: string, currentUserId?: string) {
    const user = await this.prisma.user.findUnique({
      where: { username },
      include: {
        _count: { select: { followers: true, followings: true } },
        followings: currentUserId
          ? { where: { followerId: currentUserId } }
          : false,
      },
    });
    if (!user) return null;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password, ...safe } = user;

    if (currentUserId && user.id !== currentUserId) {
      const flags = await this.blockService.getBlockFlags(currentUserId, user.id);
      if (flags) {
        return {
          id: user.id,
          username: user.username,
          displayName: null,
          email: null,
          bio: null,
          location: null,
          job: null,
          website: null,
          img: null,
          cover: null,
          emailVerified: null,
          role: safe.role,
          banned: safe.banned,
          createdAt: safe.createdAt,
          updatedAt: safe.updatedAt,
          profileRestricted: true,
          blockedByYou: flags.blockedByViewer,
          blockedYou: flags.blockedYou,
          isBlocked: true,
          followings: [],
          _count: { followers: 0, followings: 0 },
        };
      }
    }

    const isBlocked = false;
    return { ...safe, isBlocked, profileRestricted: false };
  }

  async listBlockedAccounts(blockerId: string) {
    const rows = await this.prisma.block.findMany({
      where: { blockerId },
      select: {
        blocked: {
          select: { id: true, username: true, displayName: true, img: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return { users: rows.map((r) => r.blocked) };
  }

  async getPostsByTab(
    username: string,
    tab: string,
    cursor: number,
    currentUserId?: string,
    q?: string,
  ) {
    const profileUser = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (
      profileUser &&
      currentUserId &&
      profileUser.id !== currentUserId &&
      (await this.blockService.isBlockedPair(currentUserId, profileUser.id))
    ) {
      throw new ForbiddenException('Profile content unavailable');
    }

    if (tab === 'replies') {
      return this.getUserComments(username, cursor, currentUserId);
    }

    const term = (q ?? '').trim();

    let whereCondition: object;
    if (tab === 'media') {
      whereCondition = {
        user: { username },
        parentPostId: null,
        deletedAt: null,
        communityId: null,
        media: { some: {} },
      };
    } else if (tab === 'likes') {
      whereCondition = { likes: { some: { user: { username } } }, deletedAt: null };
    } else {
      whereCondition = {
        user: { username },
        parentPostId: null,
        deletedAt: null,
        communityId: null,
        ...(term
          ? {
              OR: [
                { desc: { contains: term, mode: 'insensitive' as const } },
                { rePost: { desc: { contains: term, mode: 'insensitive' as const } } },
              ],
            }
          : {}),
      };
    }

    const include = this.postInclude(currentUserId);
    const posts = await this.prisma.post.findMany({
      where: whereCondition,
      include: {
        rePost: { include },
        ...include,
      },
      take: POST_LIMIT,
      skip: (cursor - 1) * POST_LIMIT,
      orderBy: { createdAt: 'desc' },
    });
    const total = await this.prisma.post.count({ where: whereCondition });
    return { posts, hasMore: cursor * POST_LIMIT < total };
  }

  private async getUserComments(
    username: string,
    cursor: number,
    currentUserId?: string,
  ) {
    const where = { user: { username }, deletedAt: null };
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (cursor - 1) * POST_LIMIT,
        take: POST_LIMIT,
        include: {
          user: { select: { displayName: true, username: true, img: true } },
          _count: { select: { replies: true, likes: true } },
          likes: currentUserId
            ? { where: { userId: currentUserId }, select: { id: true } }
            : (false as const),
          post: {
            select: {
              id: true,
              desc: true,
              createdAt: true,
              userId: true,
              user: { select: { username: true, displayName: true, img: true } },
            },
          },
        },
      }),
      this.prisma.comment.count({ where }),
    ]);
    return { posts: comments, hasMore: cursor * POST_LIMIT < total };
  }

  async searchFollowing(userId: string, q: string) {
    const where: any = { followerId: userId };
    if (q.trim()) {
      where.following = {
        OR: [
          { username: { contains: q.trim(), mode: 'insensitive' } },
          { displayName: { contains: q.trim(), mode: 'insensitive' } },
        ],
      };
    }

    const rows = await this.prisma.follow.findMany({
      where,
      select: {
        following: {
          select: { id: true, username: true, displayName: true, img: true },
        },
      },
      take: 10,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((r) => r.following);
  }

  async getFollowers(username: string, cursor: number, viewerId?: string) {
    const profileUser = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (
      profileUser &&
      viewerId &&
      profileUser.id !== viewerId &&
      (await this.blockService.isBlockedPair(viewerId, profileUser.id))
    ) {
      return { users: [], hasMore: false };
    }

    const rows = await this.prisma.follow.findMany({
      where: { following: { username } },
      select: {
        follower: {
          select: { id: true, username: true, displayName: true, img: true, bio: true },
        },
      },
      skip: (cursor - 1) * USER_LIMIT,
      take: USER_LIMIT,
      orderBy: { createdAt: 'desc' },
    });
    const total = await this.prisma.follow.count({ where: { following: { username } } });
    return { users: rows.map((r) => r.follower), hasMore: cursor * USER_LIMIT < total };
  }

  async getFollowing(username: string, cursor: number, viewerId?: string) {
    const profileUser = await this.prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });
    if (
      profileUser &&
      viewerId &&
      profileUser.id !== viewerId &&
      (await this.blockService.isBlockedPair(viewerId, profileUser.id))
    ) {
      return { users: [], hasMore: false };
    }

    const rows = await this.prisma.follow.findMany({
      where: { follower: { username } },
      select: {
        following: {
          select: { id: true, username: true, displayName: true, img: true, bio: true },
        },
      },
      skip: (cursor - 1) * USER_LIMIT,
      take: USER_LIMIT,
      orderBy: { createdAt: 'desc' },
    });
    const total = await this.prisma.follow.count({ where: { follower: { username } } });
    return { users: rows.map((r) => r.following), hasMore: cursor * USER_LIMIT < total };
  }

  async toggleFollow(followerId: string, followingId: string, notify?: boolean) {
    const existing = await this.prisma.follow.findFirst({
      where: { followerId, followingId },
    });

    if (existing) {
      await this.prisma.follow.delete({ where: { id: existing.id } });
      // Following graph for this follower changed -> invalidate cached followees ids.
      await this.cache.del('graph:follows', [followerId]);
      // User view changed for both follower (feed/search) and followee (notifications).
      await this.cache.incrNumber('v:user', [followerId]);
      await this.cache.incrNumber('v:user', [followingId]);
      return { following: false };
    }

    await this.prisma.follow.create({
      data: { followerId, followingId, notify: notify ?? false },
    });
    // Following graph for this follower changed -> invalidate cached followees ids.
    await this.cache.del('graph:follows', [followerId]);
    // User view changed for both follower (feed/search) and followee (notifications).
    await this.cache.incrNumber('v:user', [followerId]);
    await this.cache.incrNumber('v:user', [followingId]);
    void this.notificationsService.emit('FOLLOW', followerId, followingId);
    return { following: true };
  }

  async toggleBlock(blockerId: string, blockedId: string) {
    const existing = await this.prisma.block.findFirst({
      where: { blockerId, blockedId },
    });

    if (existing) {
      await this.prisma.block.delete({ where: { id: existing.id } });
      // Blocked peer lists changed for both directions.
      await this.blockService.invalidateBlockedPeers(blockerId);
      await this.blockService.invalidateBlockedPeers(blockedId);
      await this.cache.incrNumber('v:user', [blockerId]);
      await this.cache.incrNumber('v:user', [blockedId]);
      return { blocked: false };
    }

    await Promise.all([
      this.prisma.block.create({ data: { blockerId, blockedId } }),
      this.prisma.follow.deleteMany({
        where: {
          OR: [
            { followerId: blockerId, followingId: blockedId },
            { followerId: blockedId, followingId: blockerId },
          ],
        },
      }),
    ]);

    // Blocked peer lists changed for both directions.
    await this.blockService.invalidateBlockedPeers(blockerId);
    await this.blockService.invalidateBlockedPeers(blockedId);
    // Blocking severs mutual follows, so cached followees ids for both users must be invalidated.
    await this.cache.del('graph:follows', [blockerId]);
    await this.cache.del('graph:follows', [blockedId]);
    await this.cache.incrNumber('v:user', [blockerId]);
    await this.cache.incrNumber('v:user', [blockedId]);
    return { blocked: true };
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.displayName !== undefined && { displayName: dto.displayName }),
        ...(dto.bio !== undefined && { bio: dto.bio }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.job !== undefined && { job: dto.job }),
        ...(dto.website !== undefined && { website: dto.website }),
        ...(dto.img !== undefined && { img: dto.img }),
        ...(dto.cover !== undefined && { cover: dto.cover }),
      },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        displayName: true,
        bio: true,
        location: true,
        job: true,
        website: true,
        img: true,
        cover: true,
      },
    });
  }

  async getSavedPosts(userId: string, cursor: number) {
    const include = this.postInclude(userId);
    const [rows, total] = await Promise.all([
      this.prisma.savedPosts.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (cursor - 1) * POST_LIMIT,
        take: POST_LIMIT,
        include: { post: { include: { rePost: { include }, ...include } } },
      }),
      this.prisma.savedPosts.count({ where: { userId } }),
    ]);
    return {
      posts: rows.map((r) => r.post),
      hasMore: cursor * POST_LIMIT < total,
    };
  }

  async getRecommendations(userId: string) {
    const followedIds = (
      await this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      })
    ).map((f) => f.followingId);

    // Friends-of-friends first; fall back to popular users if < 3
    const fof = await this.prisma.user.findMany({
      where: {
        id: { not: userId, notIn: followedIds },
        followings: { some: { followerId: { in: followedIds } } },
      },
      take: 3,
      select: { id: true, displayName: true, username: true, img: true },
      orderBy: { followers: { _count: 'desc' } },
    });

    if (fof.length >= 3) return fof;

    const existing = fof.map((u) => u.id);
    const others = await this.prisma.user.findMany({
      where: { id: { not: userId, notIn: [...followedIds, ...existing] } },
      take: 3 - fof.length,
      select: { id: true, displayName: true, username: true, img: true },
      orderBy: { followers: { _count: 'desc' } },
    });

    return [...fof, ...others];
  }

  async getConnectUsers(userId: string, cursor: number) {
    const PAGE = 12;
    const followedIds = (
      await this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      })
    ).map((f) => f.followingId);

    const where = { id: { not: userId, notIn: followedIds } };

    // Friends-of-friends come first (those with mutual connections rank higher)
    const fofIds = (
      await this.prisma.user.findMany({
        where: {
          ...where,
          followings: { some: { followerId: { in: followedIds } } },
        },
        select: { id: true },
        orderBy: { followers: { _count: 'desc' } },
      })
    ).map((u) => u.id);

    // Build ordered id list: fof first, then rest by follower count
    const ordered = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        displayName: true,
        username: true,
        img: true,
        bio: true,
        _count: { select: { followers: true } },
      },
      orderBy: { followers: { _count: 'desc' } },
    });

    // Re-sort: fof IDs bubble to top
    const sorted = [
      ...ordered.filter((u) => fofIds.includes(u.id)),
      ...ordered.filter((u) => !fofIds.includes(u.id)),
    ];

    const total = sorted.length;
    const page = sorted.slice((cursor - 1) * PAGE, cursor * PAGE);

    return { users: page, hasMore: cursor * PAGE < total };
  }
}
