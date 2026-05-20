import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { verifyJwt, BLACKLIST_PREFIX } from './auth.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const token = req.cookies?.['breadit_session'];
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await verifyJwt(token);

      // Check if this token has been blacklisted (e.g., user logged out)
      const jti = payload['jti'] as string | undefined;
      if (jti) {
        const blacklisted = await this.redis.get(`${BLACKLIST_PREFIX}:${jti}`);
        if (blacklisted) throw new UnauthorizedException();
      }

      (req as unknown as Record<string, unknown>)['user'] = {
        id: payload.sub,
        username: payload['username'],
        emailVerified: payload['emailVerified'] ?? null,
        role: payload['role'] ?? 'USER',
        banned: payload['banned'] ?? false,
      };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}

