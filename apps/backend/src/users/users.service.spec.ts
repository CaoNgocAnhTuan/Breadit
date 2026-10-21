import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

/** Prisma, notifications, block service and cache are replaced by simple mocks. */
function setup() {
  const prisma = {
    user: { findUnique: jest.fn(), findMany: jest.fn() },
    follow: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    block: {
      findFirst: jest.fn(),
      create: jest.fn().mockReturnValue('block.create'),
      delete: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const notifications = { emit: jest.fn() };
  const block = {
    getAllBlockedPeerIds: jest.fn().mockResolvedValue(new Set<string>()),
    invalidateBlockedPeers: jest.fn(),
    getBlockFlags: jest.fn().mockResolvedValue(null),
    isBlockedPair: jest.fn().mockResolvedValue(false),
  };
  const cache = { del: jest.fn(), incrNumber: jest.fn() };
  const service = new UsersService(prisma as any, notifications as any, block as any, cache as any);
  return { service, prisma, notifications, block, cache };
}

describe('UsersService.toggleFollow', () => {
  it('T5: rejects following yourself with 400 and touches nothing', async () => {
    const { service, prisma } = setup();
    await expect(service.toggleFollow('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.follow.create).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('T5: rejects an unknown target with 404', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.toggleFollow('u1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.follow.create).not.toHaveBeenCalled();
  });

  it('follows, then unfollows, and sends one notification', async () => {
    const { service, prisma, notifications } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.follow.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 7 });

    await expect(service.toggleFollow('u1', 'u2')).resolves.toEqual({ following: true });
    expect(prisma.follow.create).toHaveBeenCalledWith({
      data: { followerId: 'u1', followingId: 'u2', notify: false },
    });
    expect(notifications.emit).toHaveBeenCalledWith('FOLLOW', 'u1', 'u2');

    await expect(service.toggleFollow('u1', 'u2')).resolves.toEqual({ following: false });
    expect(prisma.follow.delete).toHaveBeenCalledWith({ where: { id: 7 } });
    expect(notifications.emit).toHaveBeenCalledTimes(1);
  });
});

describe('UsersService.toggleBlock', () => {
  it('T5: rejects blocking yourself with 400', async () => {
    const { service, prisma } = setup();
    await expect(service.toggleBlock('u1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('T5: rejects an unknown target with 404', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(service.toggleBlock('u1', 'ghost')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('blocking creates the block and removes follows both ways in ONE transaction', async () => {
    const { service, prisma, block } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.block.findFirst.mockResolvedValue(null);

    await expect(service.toggleBlock('u1', 'u2')).resolves.toEqual({ blocked: true });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.follow.deleteMany).toHaveBeenCalledWith({
      where: {
        OR: [
          { followerId: 'u1', followingId: 'u2' },
          { followerId: 'u2', followingId: 'u1' },
        ],
      },
    });
    expect(block.invalidateBlockedPeers).toHaveBeenCalledWith('u1');
    expect(block.invalidateBlockedPeers).toHaveBeenCalledWith('u2');
  });

  it('unblocking still works', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'u2' });
    prisma.block.findFirst.mockResolvedValue({ id: 3 });
    await expect(service.toggleBlock('u1', 'u2')).resolves.toEqual({ blocked: false });
    expect(prisma.block.delete).toHaveBeenCalledWith({ where: { id: 3 } });
  });
});

describe('UsersService suggestions (T8, T9)', () => {
  it('T8, T9: recommendations rank by followers received, hide blocked and banned users', async () => {
    const { service, prisma, block } = setup();
    prisma.follow.findMany.mockResolvedValue([{ followingId: 'f1' }]);
    block.getAllBlockedPeerIds.mockResolvedValue(new Set(['b1']));
    prisma.user.findMany.mockResolvedValue([]);

    await service.getRecommendations('me');

    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.id.notIn).toEqual(expect.arrayContaining(['me', 'f1', 'b1']));
    expect(where.banned).toBe(false);
    // `followings` = Follow rows where this user is the one being followed = their followers.
    expect(prisma.user.findMany.mock.calls[0][0].orderBy).toEqual([
      { followings: { _count: 'desc' } },
      { id: 'asc' },
    ]);
    // the fallback query follows the same rules
    const fallback = prisma.user.findMany.mock.calls[1][0];
    expect(fallback.where.banned).toBe(false);
    expect(fallback.where.id.notIn).toEqual(expect.arrayContaining(['me', 'f1', 'b1']));
    expect(fallback.orderBy).toEqual([{ followings: { _count: 'desc' } }, { id: 'asc' }]);
  });

  it('T9: connect hides blocked and banned users and keeps the _count.followers shape', async () => {
    const { service, prisma, block } = setup();
    block.getAllBlockedPeerIds.mockResolvedValue(new Set(['b1']));
    prisma.user.findMany
      .mockResolvedValueOnce([]) // friends of friends
      .mockResolvedValueOnce([
        { id: 'a', username: 'a', displayName: null, img: null, bio: null, _count: { followings: 5 } },
      ]);

    const res = await service.getConnectUsers('me', 1);

    for (const call of prisma.user.findMany.mock.calls) {
      expect(call[0].where.id.notIn).toEqual(expect.arrayContaining(['me', 'b1']));
      expect(call[0].where.banned).toBe(false);
    }
    // The UI reads `_count.followers`; its value is now the real follower count.
    expect(res.users[0]._count).toEqual({ followers: 5 });
    expect(res.hasMore).toBe(false);
  });
});

describe('UsersService.findByUsername (S2: private fields)', () => {
  const row = {
    id: 'u2',
    username: 'bob',
    password: 'hash',
    email: 'bob@private.test',
    emailVerified: new Date('2026-01-01'),
    banned: true,
    role: 'USER',
    displayName: 'Bob',
    bio: 'hi',
    img: null,
    cover: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-02'),
    followings: [],
    _count: { followers: 1, followings: 2 },
  };

  it('never returns the password hash', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...row });
    const me = await service.findByUsername('bob', 'u2');
    const other = await service.findByUsername('bob', 'u9');
    const guest = await service.findByUsername('bob');
    for (const view of [me, other, guest]) expect(view).not.toHaveProperty('password');
  });

  it.each([
    ['a guest', undefined],
    ['another user', 'u9'],
  ])('S2: hides email, emailVerified and banned from %s', async (_label, viewer) => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...row });
    const view = await service.findByUsername('bob', viewer);
    expect(view).not.toHaveProperty('email');
    expect(view).not.toHaveProperty('emailVerified');
    expect(view).not.toHaveProperty('banned');
    // the public part is still there
    expect(view).toMatchObject({ username: 'bob', displayName: 'Bob', bio: 'hi', role: 'USER', profileRestricted: false });
    expect(view).toHaveProperty('_count');
  });

  it('S2: the owner still sees their own email, emailVerified and banned flag', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...row });
    const view = await service.findByUsername('bob', 'u2');
    expect(view).toMatchObject({ email: 'bob@private.test', banned: true });
    expect(view).toHaveProperty('emailVerified');
  });

  it('S2: the blocked-profile view has no email value and no banned flag', async () => {
    const { service, prisma, block } = setup();
    prisma.user.findUnique.mockResolvedValue({ ...row });
    block.getBlockFlags.mockResolvedValue({ blockedByViewer: true, blockedYou: false });
    const view: any = await service.findByUsername('bob', 'u9');
    expect(view.profileRestricted).toBe(true);
    expect(view.email).toBeNull();
    expect(view.emailVerified).toBeNull();
    expect(view).not.toHaveProperty('banned');
  });
});
