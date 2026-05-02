import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

@Injectable()
export class BannedUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const { user } = context.switchToHttp().getRequest();
    if (user?.banned) {
      throw new ForbiddenException('Your account has been suspended');
    }
    return true;
  }
}
