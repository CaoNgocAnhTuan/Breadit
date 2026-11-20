import { CommunityRole } from '@prisma/client';
import type { PrismaService } from '../prisma/prisma.service';

/**
 * Can this viewer see (and act on) the post? One rule for `PostsService.findOne`, the interactions and the comments.
 * An approved post is visible to everybody. A post that waits for approval (finding T10, R2) is visible only to
 * its author and to the OWNER or MOD of its community. Everybody else, guests included, gets 404 from the callers.
 * It reads `isApproved` from the row the caller passes, so the answer changes as soon as the post is approved.
 */
export async function canSeePost(
  prisma: Pick<PrismaService, 'communityMember'>,
  post: { userId: string; communityId: number | null; isApproved: boolean },
  viewerId?: string,
): Promise<boolean> {
  if (post.isApproved) return true;
  if (!viewerId) return false;
  if (post.userId === viewerId) return true;
  if (post.communityId == null) return false;
  const member = await prisma.communityMember.findUnique({
    where: { userId_communityId: { userId: viewerId, communityId: post.communityId } },
    select: { role: true },
  });
  return member?.role === CommunityRole.OWNER || member?.role === CommunityRole.MOD;
}
