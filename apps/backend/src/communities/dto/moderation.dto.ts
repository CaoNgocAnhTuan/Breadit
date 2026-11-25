import { CommunityRole } from '@prisma/client';
import { IsEnum, IsIn } from 'class-validator';

/** B1: the only two actions a mod can take on a pending post. Anything else is a 400. */
export const MODERATE_ACTIONS = ['APPROVE', 'REMOVE'] as const;
export type ModerateAction = (typeof MODERATE_ACTIONS)[number];

export class ModeratePostDto {
  @IsIn(MODERATE_ACTIONS)
  action: ModerateAction;
}

/** B1: the role must be a real `CommunityRole`. `OWNER` still gets its 403 in the service. */
export class PromoteMemberDto {
  @IsEnum(CommunityRole)
  role: CommunityRole;
}
