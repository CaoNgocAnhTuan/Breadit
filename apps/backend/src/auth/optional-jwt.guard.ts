import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { passwordVersionOf, readSession } from './session';

/**
 * Sets `req.user` when the cookie holds a good, not logged-out session. In every other case
 * (no cookie, bad token, logged out, a password reset since, Redis down) the request goes on as a guest.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  private readonly versionOf: ReturnType<typeof passwordVersionOf>;

  constructor(
    private readonly redis: RedisService,
    prisma: PrismaService,
  ) {
    this.versionOf = passwordVersionOf(prisma);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const token = req.cookies?.['breadit_session'];
    if (token) {
      try {
        const user = await readSession(token, this.redis, this.versionOf);
        if (user) (req as unknown as Record<string, unknown>)['user'] = user;
      } catch { /* Redis error: fail closed, leave req.user undefined */ }
    }
    return true;
  }
}
