import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class EmailVerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = (context.switchToHttp().getRequest() as Record<string, unknown>)['user'] as
      | { emailVerified?: string | null }
      | undefined;
    if (!user?.emailVerified) throw new ForbiddenException('Email not verified');
    return true;
  }
}
