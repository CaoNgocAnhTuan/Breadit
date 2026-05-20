import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async getUsers(cursor: number, q?: string) {
    const LIMIT = 20;
    const where = q
      ? {
          OR: [
            { username: { contains: q, mode: 'insensitive' as const } },
            { email: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const users = await this.prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        img: true,
        role: true,
        banned: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT + 1,
      skip: (cursor - 1) * LIMIT,
    });

    const hasMore = users.length > LIMIT;
    if (hasMore) users.pop();

    return { items: users, nextCursor: hasMore ? cursor + 1 : null };
  }

  async setBanStatus(id: string, banned: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, username: true },
    });
    if (!user) throw new NotFoundException();

    await this.prisma.user.update({
      where: { id },
      data: { banned },
    });

    // Emit real-time event so the banned user's browser reacts immediately
    // The client socket joins a room keyed by username (see Socket.tsx → "newUser" event)
    if (banned) {
      this.notificationsGateway.server
        .to(user.username)
        .emit('accountBanned');
    }

    return { ok: true };
  }

  async getReports(cursor: number) {
    const LIMIT = 20;
    const reports = await this.prisma.report.findMany({
      where: { status: 'OPEN' },
      include: {
        reporter: { select: { username: true } },
        post: {
          select: {
            id: true,
            desc: true,
            user: { select: { username: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: LIMIT + 1,
      skip: (cursor - 1) * LIMIT,
    });

    const hasMore = reports.length > LIMIT;
    if (hasMore) reports.pop();

    return { items: reports, nextCursor: hasMore ? cursor + 1 : null };
  }

  async dismissReport(id: number) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException();

    await this.prisma.report.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    return { ok: true };
  }

  async deleteReportedPost(id: number) {
    const report = await this.prisma.report.findUnique({ where: { id } });
    if (!report) throw new NotFoundException();

    await this.prisma.post.update({
      where: { id: report.postId },
      data: { deletedAt: new Date() },
    });

    await this.prisma.report.update({
      where: { id },
      data: { status: 'CLOSED' },
    });

    return { ok: true };
  }
}
