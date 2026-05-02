import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { verifyJwt } from './auth.service';

@Injectable()
export class OptionalJwtAuthGuard implements CanActivate {
  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<FastifyRequest>();
    const token = req.cookies?.['breadit_session'];
    if (token) {
      try {
        const payload = await verifyJwt(token);
        (req as unknown as Record<string, unknown>)['user'] = {
          id: payload.sub,
          username: payload['username'],
          emailVerified: payload['emailVerified'] ?? null,
          role: payload['role'] ?? 'USER',
          banned: payload['banned'] ?? false,
        };
      } catch { /* leave req.user undefined */ }
    }
    return true;
  }
}
