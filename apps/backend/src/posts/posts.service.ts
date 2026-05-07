import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { CommunityRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService, type BufferedFile } from '../uploads/uploads.service';
import { NotificationsService } from '../notifications/notifications.service';

const LIMIT = 3;

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly notificationsService: NotificationsService,
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

  async findAll(cursor: number, userParam?: string, userId?: string, feed?: string, communityId?: number) {
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

    let whereCondition: any;
    let orderBy: object | object[] = { createdAt: 'desc' };

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
      orderBy = [{ likes: { _count: 'desc' } }, { createdAt: 'desc' }];
    } else if (userParam && userParam !== 'undefined') {
      whereCondition = { parentPostId: null, userId: userParam, deletedAt: null, communityId: null };
    } else if (userId) {
      const followees = await this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      });
      whereCondition = {
        parentPostId: null,
        deletedAt: null,
        communityId: null,
        userId: {
          in: [userId, ...followees.map((f) => f.followingId)],
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

    return { posts, hasMore };
  }

  async findOne(postId: number, userId?: string) {
    const include = this.postInclude(userId);
    return this.prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      include: {
        ...include,
        community: { select: { name: true, slug: true } },
      },
    });
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
