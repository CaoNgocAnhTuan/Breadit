import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { UpdateUserDto } from './dto/update-user.dto';

const POST_LIMIT = 3;
const USER_LIMIT = 10;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private postInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      media: true,
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

    const isBlocked = currentUserId
      ? !!(await this.prisma.block.findFirst({
          where: {
            OR: [
              { blockerId: currentUserId, blockedId: user.id },
              { blockerId: user.id, blockedId: currentUserId },
            ],
          },
        }))
      : false;

    return { ...safe, isBlocked };
  }

  async getPostsByTab(
    username: string,
    tab: string,
    cursor: number,
    currentUserId?: string,
  ) {
    if (tab === 'replies') {
      return this.getUserComments(username, cursor, currentUserId);
    }

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
      whereCondition = { user: { username }, parentPostId: null, deletedAt: null, communityId: null };
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

  async getFollowers(username: string, cursor: number) {
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

  async getFollowing(username: string, cursor: number) {
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
      return { following: false };
    }

    await this.prisma.follow.create({
      data: { followerId, followingId, notify: notify ?? false },
    });
    void this.notificationsService.emit('FOLLOW', followerId, followingId);
    return { following: true };
  }

  async toggleBlock(blockerId: string, blockedId: string) {
    const existing = await this.prisma.block.findFirst({
      where: { blockerId, blockedId },
    });

    if (existing) {
      await this.prisma.block.delete({ where: { id: existing.id } });
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
