import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { verifyJwt } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const token = req.cookies?.['breadit_session'];
    if (!token) throw new UnauthorizedException();
    try {
      const payload = await verifyJwt(token);
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
