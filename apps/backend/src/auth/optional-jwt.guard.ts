import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RedisService } from '../redis/redis.service';
import { readSession } from './session';

/**
 * Sets `req.user` when the cookie holds a good, not logged-out session. In every other case
 * (no cookie, bad token, logged out, Redis down) the request goes on as a guest.
 */
@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const token = req.cookies?.['breadit_session'];
    if (token) {
      try {
        const user = await readSession(token, this.redis);
        if (user) (req as unknown as Record<string, unknown>)['user'] = user;
      } catch { /* Redis error: fail closed, leave req.user undefined */ }
    }
    return true;
  }
}
