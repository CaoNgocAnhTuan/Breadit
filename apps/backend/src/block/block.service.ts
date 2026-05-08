import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';

export type BlockFlags = { blockedByViewer: boolean; blockedYou: boolean };

@Injectable()
export class BlockService {
  private readonly BLOCKED_PEERS_TTL_SECONDS = 60;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  private blockedPeersPrefix() {
    return 'graph:blockedPeers';
  }

  /** True if there is any Block row between the two users (either direction). */
  async isBlockedPair(userIdA: string, userIdB: string): Promise<boolean> {
    if (userIdA === userIdB) return false;
    const row = await this.prisma.block.findFirst({
      where: {
        OR: [
          { blockerId: userIdA, blockedId: userIdB },
          { blockerId: userIdB, blockedId: userIdA },
        ],
      },
      select: { id: true },
    });
    return !!row;
  }

  /** Null if no block relation; otherwise who initiated which side (both may be true). */
  async getBlockFlags(viewerId: string, profileUserId: string): Promise<BlockFlags | null> {
    if (viewerId === profileUserId) return null;
    const [byViewer, byProfile] = await Promise.all([
      this.prisma.block.findFirst({
        where: { blockerId: viewerId, blockedId: profileUserId },
        select: { id: true },
      }),
      this.prisma.block.findFirst({
        where: { blockerId: profileUserId, blockedId: viewerId },
        select: { id: true },
      }),
    ]);
    if (!byViewer && !byProfile) return null;
    return { blockedByViewer: !!byViewer, blockedYou: !!byProfile };
  }

  async assertNotBlockedPair(userId: string, otherUserId: string) {
    if (await this.isBlockedPair(userId, otherUserId)) {
      throw new ForbiddenException('Messaging is unavailable with this user.');
    }
  }

  /** All user IDs that have any block relationship with viewerId (either direction). */
  async getAllBlockedPeerIds(viewerId: string): Promise<Set<string>> {
    const cached = await this.cache.getJson<string[]>(
      this.blockedPeersPrefix(),
      [viewerId],
    );
    if (cached) return new Set(cached);

    const rows = await this.prisma.block.findMany({
      where: { OR: [{ blockerId: viewerId }, { blockedId: viewerId }] },
      select: { blockerId: true, blockedId: true },
    });

    const set = new Set<string>();
    for (const r of rows) {
      set.add(r.blockerId === viewerId ? r.blockedId : r.blockerId);
    }

    // TTL-based: correctness is maintained by invalidation on block/unblock.
    await this.cache.setJson(this.blockedPeersPrefix(), [viewerId], [...set], this.BLOCKED_PEERS_TTL_SECONDS);
    return set;
  }

  async invalidateBlockedPeers(viewerId: string): Promise<void> {
    await this.cache.del(this.blockedPeersPrefix(), [viewerId]);
  }
}
