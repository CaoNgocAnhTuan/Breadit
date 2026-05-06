import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private commentInclude(userId?: string) {
    return {
      user: { select: { displayName: true, username: true, img: true } },
      _count: { select: { replies: true, likes: true } },
      likes: userId
        ? { where: { userId }, select: { id: true } }
        : (false as const),
    };
  }

  async findByPost(postId: number, userId?: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId } });
    if (!post || post.deletedAt) throw new NotFoundException();

    const include = this.commentInclude(userId);

    const comments = await this.prisma.comment.findMany({
      where: { postId, parentCommentId: null, deletedAt: null },
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
    const comment = await this.prisma.comment.create({
      data: {
        body,
        userId,
        postId,
        parentCommentId: parentCommentId ?? null,
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
      const mentions = [
        ...new Set(
          [...body.matchAll(/@([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
        ),
      ];
      if (mentions.length > 0) {
        const mentionedUsers = await this.prisma.user.findMany({
          where: { username: { in: mentions } },
          select: { id: true },
        });
        void Promise.all(
          mentionedUsers.map((u) =>
            this.notificationsService.emit('MENTION', userId, u.id, postId),
          ),
        );
      }
    }

    return comment;
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
