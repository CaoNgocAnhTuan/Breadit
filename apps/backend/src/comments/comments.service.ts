import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UploadsService, type BufferedFile } from '../uploads/uploads.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
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

  private commentInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      mentions: this.mentionInclude(),
      media: true,
      _count: { select: { replies: true, likes: true } },
      likes: userId
        ? { where: { userId }, select: { id: true } }
        : (false as const),
    };
  }

  async findByPost(postId: number, userId?: string, sort = 'relevant') {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException();

    const include = this.commentInclude(userId);

    // Top-level comment sort; replies always chronological
    let topLevelOrderBy: object | object[];
    if (sort === 'top') {
      topLevelOrderBy = { likes: { _count: 'desc' as const } };
    } else if (sort === 'recent') {
      topLevelOrderBy = { createdAt: 'desc' as const };
    } else {
      // 'relevant' — placeholder: same as recent until smart ranking is implemented
      topLevelOrderBy = { createdAt: 'desc' as const };
    }

    const comments = await this.prisma.comment.findMany({
      where: { postId, parentCommentId: null, deletedAt: null },
      orderBy: topLevelOrderBy,
      include: {
        ...include,
        replies: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: {
            ...include,
            replies: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              include: {
                ...include,
                replies: {
                  where: { deletedAt: null },
                  orderBy: { createdAt: 'asc' },
                  include: {
                    ...include,
                    replies: {
                      where: { deletedAt: null },
                      orderBy: { createdAt: 'asc' },
                      include,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return comments;
  }

  async create(
    userId: string,
    postId: number,
    body: string,
    parentCommentId?: number,
    files: BufferedFile[] = [],
  ) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });
    if (!post || !post.id) throw new NotFoundException('Post not found');

    if (parentCommentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentCommentId },
        select: { id: true, postId: true },
      });
      if (!parentComment || parentComment.postId !== postId) {
        throw new NotFoundException('Parent comment not found');
      }
    }

    const include = this.commentInclude(userId);
    const uploadedMedia: { url: string; type: string }[] = [];
    for (const file of files) {
      const url = await this.uploadsService.saveFile(file);
      const type = this.uploadsService.isVideo(file) ? 'VIDEO' : 'IMAGE';
      uploadedMedia.push({ url, type });
    }

    const comment = await this.prisma.comment.create({
      data: {
        body,
        userId,
        postId,
        parentCommentId: parentCommentId ?? null,
        media: {
          create: uploadedMedia.map((m) => ({
            url: m.url,
            type: m.type,
          })),
        },
      },
      include,
    });

    if (parentCommentId) {
      const parentComment = await this.prisma.comment.findUnique({
        where: { id: parentCommentId },
        select: { userId: true },
      });
      if (parentComment) {
        void this.notificationsService.emit(
          'REPLY',
          userId,
          parentComment.userId,
          postId,
        );
      }
    } else {
      void this.notificationsService.emit(
        'REPLY',
        userId,
        post.userId,
        postId,
      );
    }

    if (body) {
      const mentionUsernames = [
        ...new Set(
          [...body.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
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
              commentId: comment.id,
              userId: u.id,
              username: u.username,
            })),
          });
          void Promise.all(
            mentionedUsers.map((u) =>
              this.notificationsService.emit('MENTION', userId, u.id, postId),
            ),
          );
        }
      }
    }

    return comment;
  }

  async update(
    commentId: number,
    userId: string,
    body: { body?: string; mediaIdsToRemove?: number[] },
    files: BufferedFile[] = [],
  ) {
    const existing = await this.prisma.comment.findUnique({
      where: { id: commentId },
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

    const include = this.commentInclude(userId);
    await this.prisma.$transaction(async (tx) => {
      if (mediaIdsToRemove.length) {
        await tx.commentMedia.deleteMany({
          where: { id: { in: mediaIdsToRemove }, commentId },
        });
      }

      if (uploadedMedia.length) {
        await tx.commentMedia.createMany({
          data: uploadedMedia.map((m) => ({ commentId, url: m.url, type: m.type })),
        });
      }

      if (body.body !== undefined) {
        await tx.comment.update({
          where: { id: commentId },
          data: { body: body.body },
        });

        await tx.mention.deleteMany({ where: { commentId } });

        const mentionUsernames = [
          ...new Set(
            [...body.body.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
          ),
        ];
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
                commentId,
                userId: u.id,
                username: u.username,
              })),
            });
          }
        }
      }
    });

    return this.prisma.comment.findUnique({
      where: { id: commentId },
      include,
    });
  }

  async remove(commentId: number, userId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment || comment.deletedAt) throw new NotFoundException();
    if (comment.userId !== userId) throw new ForbiddenException();

    await this.prisma.comment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  }

  async toggleLike(userId: string, commentId: number) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true },
    });
    if (!comment) throw new NotFoundException();

    const existing = await this.prisma.commentLike.findUnique({
      where: { userId_commentId: { userId, commentId } },
    });

    if (existing) {
      await this.prisma.commentLike.delete({ where: { id: existing.id } });
    } else {
      await this.prisma.commentLike.create({ data: { userId, commentId } });
      void this.notificationsService.emit(
        'LIKE',
        userId,
        comment.userId,
        comment.postId,
      );
    }

    const count = await this.prisma.commentLike.count({ where: { commentId } });
    return { liked: !existing, count };
  }

  async getUserComments(userId: string, cursor: number, currentUserId?: string) {
    const LIMIT = 3;
    const include = this.commentInclude(currentUserId);

    const where = { userId, deletedAt: null };
    const [comments, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (cursor - 1) * LIMIT,
        take: LIMIT,
        include: {
          ...include,
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

    return { comments, hasMore: cursor * LIMIT < total };
  }
}
