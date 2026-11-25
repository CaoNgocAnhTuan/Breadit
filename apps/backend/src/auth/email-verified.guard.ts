import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Write actions need a verified email. A token that says "verified" passes with no read: nothing undoes a
 * verification. A token that says "not verified" may be older than the user's code entry (B5), so the database
 * decides, and `req.user.emailVerified` is filled for the route. Only unverified users pay the read.
 */
@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const user = (context.switchToHttp().getRequest() as Record<string, unknown>)['user'] as
      | { id?: string; emailVerified?: string | null }
      | undefined;
    if (user?.emailVerified) return true;

    if (user?.id) {
      const row = await this.prisma.user.findUnique({ where: { id: user.id }, select: { emailVerified: true } });
      if (row?.emailVerified) {
        user.emailVerified = row.emailVerified.toISOString();
        return true;
      }
    }
    throw new ForbiddenException('Email not verified');
  }
}
