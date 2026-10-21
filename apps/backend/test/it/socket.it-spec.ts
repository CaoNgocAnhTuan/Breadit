import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { client, createTestApp } from './helpers/app';
import { closePrisma, createUserWithCookie, uniq } from './helpers/factory';
import { connectSocket, listen, sleep, type TestSocket } from './helpers/socket';

type U = Awaited<ReturnType<typeof createUserWithCookie>>;

describe('S1, S5: socket auth', () => {
  let app: NestFastifyApplication;
  let url: string;
  let alice: U; // the attacker, not in the conversation
  let bob: U;
  let carol: U;
  let conversationId: number;
  const open: TestSocket[] = [];

  const as = (u: U) => client(app, u.cookie);
  async function connect(u: U) {
    const r = await connectSocket(url, u.cookie);
    open.push(r.socket);
    return r;
  }

  beforeAll(async () => {
    app = await createTestApp();
    url = await listen(app);
    [alice, bob, carol] = await Promise.all(
      ['alice', 'bob', 'carol'].map((n) => createUserWithCookie({ username: uniq(n) })),
    );
    const conv = await as(bob).post('/api/conversations', { targetUserId: carol.user.id });
    expect(conv.status).toBe(201);
    conversationId = conv.body.id;
  });

  afterEach(async () => {
    while (open.length) open.pop()!.close();
    await sleep(50);
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  it('S1: alice claims to be bob with newUser and still does NOT get bob\'s DM', async () => {
    const a = (await connect(alice)).socket;
    const b = (await connect(bob)).socket;
    b.emit('newUser', bob.user.username);
    a.emit('newUser', bob.user.username); // the attack
    await sleep(300);

    const sent = await as(carol).post(`/api/conversations/${conversationId}/messages`, { body: 'secret DM for bob only' });
    expect(sent.status).toBe(201);
    await sleep(500);

    expect(b.log.newMessage).toHaveLength(1);
    expect(b.log.newMessage[0].message.body).toBe('secret DM for bob only');
    expect(a.log.newMessage).toHaveLength(0);
  });

  it('bob gets his DM even if he never sends newUser (the server joins him on connect)', async () => {
    const b = (await connect(bob)).socket;
    await sleep(200);
    await as(carol).post(`/api/conversations/${conversationId}/messages`, { body: 'no newUser needed' });
    await sleep(500);
    expect(b.log.newMessage.map((m) => m.message.body)).toContain('no newUser needed');
  });

  it('S1: a client cannot push a fake notification to another user', async () => {
    const a = (await connect(alice)).socket;
    const c = (await connect(carol)).socket;
    c.emit('newUser', carol.user.username); // like the frontend does, so carol is in her room
    await sleep(300);
    a.emit('sendNotification', { receiverUsername: carol.user.username, data: { type: 'LIKE', actor: { username: 'fake' } } });
    await sleep(500);
    expect(c.log.getNotification).toHaveLength(0);
  });

  it('real notifications still arrive (regression): a follow reaches the followed user', async () => {
    const b = (await connect(bob)).socket;
    await sleep(200);
    expect((await as(alice).post(`/api/users/${bob.user.id}/follow`, {})).status).toBe(200);
    await sleep(500);
    expect(b.log.getNotification.length).toBeGreaterThan(0);
    expect(b.log.getNotification[0].type).toBe('FOLLOW');
    await as(alice).post(`/api/users/${bob.user.id}/follow`, {}); // unfollow again
  });

  it('S1: a non-member who joins the conversation room gets no typing events; members do, with the real username', async () => {
    const a = (await connect(alice)).socket;
    const b = (await connect(bob)).socket;
    const c = (await connect(carol)).socket;
    a.emit('joinConversation', conversationId);
    b.emit('joinConversation', conversationId);
    c.emit('joinConversation', conversationId);
    await sleep(500);

    c.emit('startTyping', { conversationId, username: 'someone_else' });
    await sleep(500);

    expect(a.log.userTyping).toHaveLength(0);
    expect(b.log.userTyping).toHaveLength(1);
    expect(b.log.userTyping[0]).toEqual({ conversationId, username: carol.user.username });
  });

  it('S1: a non-member cannot emit typing events into the room either', async () => {
    const a = (await connect(alice)).socket;
    const b = (await connect(bob)).socket;
    b.emit('joinConversation', conversationId);
    await sleep(400);
    a.emit('joinConversation', conversationId); // refused
    a.emit('startTyping', { conversationId, username: carol.user.username });
    await sleep(500);
    expect(b.log.userTyping).toHaveLength(0);
  });

  it('S5: a logged-out token cannot connect, a live one can', async () => {
    const eve = await createUserWithCookie({ username: uniq('eve') });
    const before = await connectSocket(url, eve.cookie);
    open.push(before.socket);
    expect(before.connected).toBe(true);

    expect((await client(app, eve.cookie).post('/api/auth/logout')).status).toBe(200);

    const after = await connectSocket(url, eve.cookie);
    open.push(after.socket);
    expect(after.connected).toBe(false);
  });

  it('a missing or invalid cookie cannot connect', async () => {
    const none = await connectSocket(url, '');
    open.push(none.socket);
    expect(none.connected).toBe(false);
    const bad = await connectSocket(url, 'breadit_session=not.a.token');
    open.push(bad.socket);
    expect(bad.connected).toBe(false);
  });

  it('accountBanned still reaches the banned user (regression)', async () => {
    const admin = await createUserWithCookie({ username: uniq('admin'), role: 'ADMIN' });
    const victim = await createUserWithCookie({ username: uniq('victim') });
    const v = (await connect(victim)).socket;
    v.emit('newUser', victim.user.username); // like the frontend does
    await sleep(300);
    expect((await as(admin).post(`/api/admin/users/${victim.user.id}/ban`)).status).toBe(200);
    await sleep(500);
    expect(v.log.accountBanned).toHaveLength(1);
  });
});
