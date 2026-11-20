import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { RedisService } from '../redis/redis.service';
import { readSession } from './session';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly redis: RedisService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const token = req.cookies?.['breadit_session'];
    if (!token) throw new UnauthorizedException();
    try {
      const user = await readSession(token, this.redis);
      if (!user) throw new UnauthorizedException();
      (req as unknown as Record<string, unknown>)['user'] = user;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
