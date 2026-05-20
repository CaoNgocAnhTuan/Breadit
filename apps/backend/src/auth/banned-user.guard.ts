import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BannedUserGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { user } = context.switchToHttp().getRequest();
    if (!user?.id) return true;

    // Query DB for fresh banned status — JWT payload can be stale (up to 30 days)
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { banned: true },
    });

    if (dbUser?.banned) {
      throw new ForbiddenException('Your account has been suspended');
    }
    return true;
  }
}
