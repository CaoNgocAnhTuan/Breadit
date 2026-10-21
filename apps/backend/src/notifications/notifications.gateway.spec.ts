import { SignJWT } from 'jose';
import { BLACKLIST_PREFIX } from '../auth/auth.service';
import { NotificationsGateway } from './notifications.gateway';

const SECRET = 'unit-test-secret-unit-test-secret-0123456789';

async function tokenFor(user: { id: string; username: string }, jti = 'jti-1') {
  return new SignJWT({ sub: user.id, username: user.username, jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(SECRET));
}

function fakeSocket(cookie?: string, rooms: string[] = []) {
  const emit = jest.fn();
  return {
    data: {} as { user?: { id: string; username: string } },
    handshake: { headers: { cookie } },
    rooms: new Set<string>(rooms),
    join: jest.fn(async function (this: any, room: string) {
      this.rooms.add(room);
    }),
    leave: jest.fn(),
    disconnect: jest.fn(),
    to: jest.fn().mockReturnValue({ emit }),
    _emit: emit,
  };
}

function setup(opts: { blacklisted?: boolean; isMember?: boolean } = {}) {
  const prisma = {
    conversationMember: {
      findUnique: jest.fn().mockResolvedValue(opts.isMember ? { userId: 'x' } : null),
    },
  };
  const redis = { get: jest.fn().mockResolvedValue(opts.blacklisted ? '1' : null) };
  const gateway = new NotificationsGateway(prisma as any, redis as any);
  return { gateway, prisma, redis };
}

describe('NotificationsGateway (S1)', () => {
  const alice = { id: 'id-alice', username: 'alice' };
  let aliceCookie: string;

  beforeAll(async () => {
    process.env.JWT_SECRET = SECRET;
    aliceCookie = `breadit_session=${await tokenFor(alice)}`;
  });

  describe('authenticate (runs before the connection exists)', () => {
    it('a valid token puts the user on the socket', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(aliceCookie);
      await gateway.authenticate(socket as any);
      expect(socket.data.user).toEqual(alice);
    });

    it('no cookie is rejected', async () => {
      const { gateway } = setup();
      await expect(gateway.authenticate(fakeSocket(undefined) as any)).rejects.toThrow();
    });

    it('a garbage token is rejected', async () => {
      const { gateway } = setup();
      await expect(gateway.authenticate(fakeSocket('breadit_session=not.a.token') as any)).rejects.toThrow();
    });

    it('S5: a logged-out (blacklisted) token is rejected', async () => {
      const { gateway, redis } = setup({ blacklisted: true });
      await expect(gateway.authenticate(fakeSocket(aliceCookie) as any)).rejects.toThrow();
      expect(redis.get).toHaveBeenCalledWith(`${BLACKLIST_PREFIX}:jti-1`);
    });
  });

  describe('rooms', () => {
    it('on connect the server joins the socket to its OWN user room', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(aliceCookie);
      await gateway.authenticate(socket as any);
      await gateway.handleConnection(socket as any);
      expect(socket.join).toHaveBeenCalledTimes(1);
      expect(socket.join).toHaveBeenCalledWith('alice');
    });

    it('a socket without a verified user is disconnected, not joined', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(undefined);
      await gateway.handleConnection(socket as any);
      expect(socket.disconnect).toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('S1: newUser("bob") from alice does NOT join the room "bob"', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(aliceCookie);
      await gateway.authenticate(socket as any);
      await gateway.handleNewUser(socket as any);
      expect(socket.join).not.toHaveBeenCalledWith('bob');
      expect(socket.join).toHaveBeenCalledWith('alice');
    });

    it('S1: the old sendNotification handler is gone', () => {
      const { gateway } = setup();
      expect((gateway as any).handleSendNotification).toBeUndefined();
    });
  });

  describe('joinConversation', () => {
    it('a member joins the conversation room', async () => {
      const { gateway, prisma } = setup({ isMember: true });
      const socket = fakeSocket(aliceCookie);
      await gateway.authenticate(socket as any);
      await gateway.handleJoinConversation(socket as any, 7);
      expect(prisma.conversationMember.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { conversationId_userId: { conversationId: 7, userId: 'id-alice' } } }),
      );
      expect(socket.join).toHaveBeenCalledWith('conversation:7');
    });

    it('S1: a non-member does not join', async () => {
      const { gateway } = setup({ isMember: false });
      const socket = fakeSocket(aliceCookie);
      await gateway.authenticate(socket as any);
      await gateway.handleJoinConversation(socket as any, 7);
      expect(socket.join).not.toHaveBeenCalled();
    });

    it.each([['abc'], [-1], [0], [1.5], [null], [undefined]])('ignores the bad id %p without a database query', async (id) => {
      const { gateway, prisma } = setup({ isMember: true });
      const socket = fakeSocket(aliceCookie);
      await gateway.authenticate(socket as any);
      await gateway.handleJoinConversation(socket as any, id as any);
      expect(prisma.conversationMember.findUnique).not.toHaveBeenCalled();
      expect(socket.join).not.toHaveBeenCalled();
    });
  });

  describe('typing events', () => {
    it('S1: startTyping sends the REAL username, not the one in the payload', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(aliceCookie, ['conversation:7']);
      await gateway.authenticate(socket as any);
      gateway.handleStartTyping(socket as any, { conversationId: 7, username: 'someone_else' } as any);
      expect(socket.to).toHaveBeenCalledWith('conversation:7');
      expect(socket._emit).toHaveBeenCalledWith('userTyping', { conversationId: 7, username: 'alice' });
    });

    it('S1: a socket that is not in the room cannot emit into it', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(aliceCookie, []);
      await gateway.authenticate(socket as any);
      gateway.handleStartTyping(socket as any, { conversationId: 7 } as any);
      gateway.handleStopTyping(socket as any, { conversationId: 7 } as any);
      expect(socket.to).not.toHaveBeenCalled();
    });

    it('stopTyping works from inside the room', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(aliceCookie, ['conversation:7']);
      await gateway.authenticate(socket as any);
      gateway.handleStopTyping(socket as any, { conversationId: 7 } as any);
      expect(socket._emit).toHaveBeenCalledWith('userStopTyping', { conversationId: 7 });
    });

    it('leaveConversation leaves the room', async () => {
      const { gateway } = setup();
      const socket = fakeSocket(aliceCookie, ['conversation:7']);
      gateway.handleLeaveConversation(socket as any, 7);
      expect(socket.leave).toHaveBeenCalledWith('conversation:7');
    });
  });
});
