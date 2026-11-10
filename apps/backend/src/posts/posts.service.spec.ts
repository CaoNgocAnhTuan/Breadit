import { PostsService } from './posts.service';

// TC11 (T3): creating and deleting a post bump the author's `v:user`, so the author's own feeds are not stale.
// Prisma, uploads, notifications, block service, cache and feed are replaced by plain mocks.

function setup() {
  const order: string[] = [];
  const prisma = {
    post: {
      create: jest.fn(async () => {
        order.push('post.create');
        return { id: 5, userId: 'author-1' };
      }),
      findUnique: jest.fn().mockResolvedValue({ id: 5, userId: 'author-1', deletedAt: null }),
      update: jest.fn(async () => {
        order.push('post.update');
        return {};
      }),
      findFirst: jest.fn(),
    },
    community: { findUnique: jest.fn() },
    communityBannedUser: { findUnique: jest.fn() },
    communityMember: { findUnique: jest.fn(), findMany: jest.fn().mockResolvedValue([]) },
    follow: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const cache = {
    incrNumber: jest.fn(async () => {
      order.push('incrNumber');
      return 1;
    }),
  };
  const service = new PostsService(
    prisma as any,
    { saveFile: jest.fn(), isVideo: jest.fn() } as any,
    { emit: jest.fn() } as any,
    { getAllBlockedPeerIds: jest.fn().mockResolvedValue(new Set()) } as any,
    cache as any,
    { rank: jest.fn() } as any,
    { defaultAlgo: null, asOfEnabled: false },
  );
  return { service, prisma, cache, order };
}

describe('PostsService T3: bump v:user for the author', () => {
  it('create (text only) bumps the author after the row is written', async () => {
    const { service, cache, order } = setup();
    await service.create('author-1', { desc: 'hello' });
    expect(cache.incrNumber).toHaveBeenCalledTimes(1);
    expect(cache.incrNumber).toHaveBeenCalledWith('v:user', ['author-1']);
    expect(order).toEqual(['post.create', 'incrNumber']);
  });

  it('remove bumps the author after the row is updated', async () => {
    const { service, cache, order } = setup();
    await expect(service.remove(5, 'author-1')).resolves.toEqual({ success: true });
    expect(cache.incrNumber).toHaveBeenCalledTimes(1);
    expect(cache.incrNumber).toHaveBeenCalledWith('v:user', ['author-1']);
    expect(order).toEqual(['post.update', 'incrNumber']);
  });

  it('remove of a post that is not yours does not bump anything', async () => {
    const { service, cache, prisma } = setup();
    prisma.post.findUnique.mockResolvedValue({ id: 5, userId: 'someone-else', deletedAt: null });
    await expect(service.remove(5, 'author-1')).rejects.toThrow();
    expect(cache.incrNumber).not.toHaveBeenCalled();
  });
});
