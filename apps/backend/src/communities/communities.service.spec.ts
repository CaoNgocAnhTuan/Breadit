import { CommunityRole } from '@prisma/client';
import { CommunitiesService } from './communities.service';

// TC12 (B6, F21). The IT tests turn the JSON cache off, and then `CacheService.del` does nothing, so the cache is a
// fake here and the test looks at the calls.

function setup() {
  const order: string[] = [];
  const tx = {
    post: { updateMany: jest.fn().mockResolvedValue({}) },
    communityBannedUser: { deleteMany: jest.fn().mockResolvedValue({}) },
    communityRule: { deleteMany: jest.fn().mockResolvedValue({}) },
    communityMember: {
      findMany: jest.fn().mockResolvedValue([{ userId: 'owner' }, { userId: 'm1' }, { userId: 'm2' }]),
      deleteMany: jest.fn().mockResolvedValue({}),
    },
    community: { delete: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    communityMember: { findUnique: jest.fn(), deleteMany: jest.fn().mockReturnValue('member.deleteMany') },
    communityBannedUser: { upsert: jest.fn().mockReturnValue('ban.upsert') },
    $transaction: jest.fn(async (arg: unknown) => {
      order.push('transaction');
      if (typeof arg === 'function') return (arg as (t: typeof tx) => unknown)(tx);
      return [];
    }),
  };
  const cache = {
    del: jest.fn(async (prefix: string, parts: unknown[]) => {
      order.push(`del ${prefix} ${parts.join(',')}`);
    }),
    incrNumber: jest.fn(async (prefix: string, parts: unknown[]) => {
      order.push(`incr ${prefix} ${parts.join(',')}`);
      return 1;
    }),
  };
  const service = new CommunitiesService(prisma as any, { emit: jest.fn() } as any, {} as any, cache as any);
  return { service, prisma, tx, cache, order };
}

describe('CommunitiesService.banUser (B6)', () => {
  it('clears graph:communities and bumps v:user of the target, after the transaction', async () => {
    const { service, prisma, cache, order } = setup();
    prisma.communityMember.findUnique
      .mockResolvedValueOnce({ role: CommunityRole.OWNER }) // the actor
      .mockResolvedValueOnce({ role: CommunityRole.MEMBER }); // the target
    await expect(service.banUser('owner', 7, 'target', 'spam')).resolves.toEqual({ success: true });
    expect(cache.del).toHaveBeenCalledWith('graph:communities', ['target']);
    expect(cache.incrNumber).toHaveBeenCalledWith('v:user', ['target']);
    expect(order).toEqual(['transaction', 'del graph:communities target', 'incr v:user target']);
  });

  it('does not touch the cache when the actor is not a mod or an owner', async () => {
    const { service, prisma, cache } = setup();
    prisma.communityMember.findUnique.mockResolvedValueOnce({ role: CommunityRole.MEMBER });
    await expect(service.banUser('plain', 7, 'target')).rejects.toThrow();
    expect(cache.del).not.toHaveBeenCalled();
    expect(cache.incrNumber).not.toHaveBeenCalled();
  });

  it('does not touch the cache when the target is the owner', async () => {
    const { service, prisma, cache } = setup();
    prisma.communityMember.findUnique
      .mockResolvedValueOnce({ role: CommunityRole.MOD })
      .mockResolvedValueOnce({ role: CommunityRole.OWNER });
    await expect(service.banUser('mod', 7, 'owner')).rejects.toThrow();
    expect(cache.del).not.toHaveBeenCalled();
    expect(cache.incrNumber).not.toHaveBeenCalled();
  });
});

describe('CommunitiesService.deleteCommunity (B6, F21)', () => {
  it('reads the member ids inside the transaction, then clears and bumps every former member after it', async () => {
    const { service, prisma, tx, cache, order } = setup();
    prisma.communityMember.findUnique.mockResolvedValueOnce({ role: CommunityRole.OWNER });
    await expect(service.deleteCommunity('owner', 7)).resolves.toEqual({ success: true });

    // the member ids are read in the transaction, before the members are deleted
    expect(tx.communityMember.findMany).toHaveBeenCalledTimes(1);
    expect(tx.communityMember.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.communityMember.deleteMany.mock.invocationCallOrder[0],
    );
    for (const id of ['owner', 'm1', 'm2']) {
      expect(cache.del).toHaveBeenCalledWith('graph:communities', [id]);
      expect(cache.incrNumber).toHaveBeenCalledWith('v:user', [id]);
    }
    expect(cache.del).toHaveBeenCalledTimes(3);
    expect(cache.incrNumber).toHaveBeenCalledTimes(3);
    // all the cache calls come after the transaction
    expect(order[0]).toBe('transaction');
    expect(order.slice(1)).toHaveLength(6);
  });

  it('does not touch the cache when the caller is not the owner', async () => {
    const { service, prisma, cache } = setup();
    prisma.communityMember.findUnique.mockResolvedValueOnce({ role: CommunityRole.MOD });
    await expect(service.deleteCommunity('mod', 7)).rejects.toThrow();
    expect(cache.del).not.toHaveBeenCalled();
    expect(cache.incrNumber).not.toHaveBeenCalled();
  });
});
