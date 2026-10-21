#!/usr/bin/env node
/**
 * Socket.IO checks for the pre-thesis bug sweep (finding S1, plus the socket part of S5).
 * Plan: .docs/works/21-10-bugs-sweep-pre-thesis.md
 *
 * Normally started by scripts/verify-bug-sweep.sh. To run it alone, pass these env vars:
 *   BASE_URL     backend URL, default http://localhost:4000
 *   ALICE_TOKEN  session token of a user who is NOT in the conversation
 *   BOB_TOKEN    session token of conversation member 1
 *   CAROL_TOKEN  session token of conversation member 2
 *   STALE_TOKEN  a token that was logged out (blacklisted)
 *   CONV_ID      id of the bob <-> carol conversation
 *   BOB_ID, BOB_NAME, CAROL_NAME   ids and usernames of bob and carol
 *
 * Prints PASS or FAIL per check and exits 1 on any FAIL. The rows marked "S1" assert the
 * behaviour we want AFTER the fix, so they print FAIL on the old code.
 */
const { io } = require('socket.io-client');

const env = process.env;
const BASE = env.BASE_URL || 'http://localhost:4000';
for (const k of ['ALICE_TOKEN', 'BOB_TOKEN', 'CAROL_TOKEN', 'STALE_TOKEN', 'CONV_ID', 'BOB_ID', 'BOB_NAME', 'CAROL_NAME']) {
  if (!env[k]) {
    console.error(`missing env ${k}`);
    process.exit(2);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const record = (id, desc, ok) => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(4)} ${desc}`);
};

function connect(token, name) {
  const s = io(BASE, {
    extraHeaders: { cookie: `breadit_session=${token}` },
    transports: ['websocket'],
    reconnection: false,
  });
  s.log = { newMessage: [], getNotification: [], userTyping: [] };
  s.name = name;
  for (const ev of Object.keys(s.log)) s.on(ev, (d) => s.log[ev].push(d));
  s.up = new Promise((resolve) => {
    s.on('connect', () => resolve(true));
    s.on('connect_error', () => resolve(false));
    s.on('disconnect', () => resolve(false));
    setTimeout(() => resolve(s.connected), 2500);
  });
  return s;
}

async function api(method, path, token, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { cookie: `breadit_session=${token}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.status;
}

(async () => {
  const alice = connect(env.ALICE_TOKEN, 'alice'); // the attacker, not a member
  const bob = connect(env.BOB_TOKEN, 'bob'); // announces himself like the frontend does
  const bob2 = connect(env.BOB_TOKEN, 'bob2'); // never sends newUser
  const carol = connect(env.CAROL_TOKEN, 'carol');
  await Promise.all([alice.up, bob.up, bob2.up, carol.up]);

  // like the frontend (components/Socket.tsx)
  bob.emit('newUser', env.BOB_NAME);
  carol.emit('newUser', env.CAROL_NAME);
  // the attack: alice claims to be bob
  alice.emit('newUser', env.BOB_NAME);
  await sleep(500);

  // 1. carol sends a DM to bob over HTTP
  const sent = await api('POST', `/api/conversations/${env.CONV_ID}/messages`, env.CAROL_TOKEN, { body: 'secret DM for bob only' });
  await sleep(800);
  record('W', `carol sends a DM (HTTP ${sent})`, sent === 201);
  record('W', 'bob receives newMessage after newUser', bob.log.newMessage.length > 0);
  record('S1', 'alice (claiming to be bob) does NOT receive the DM', alice.log.newMessage.length === 0);
  record('S1', 'bob receives it even without sending newUser (joined on connect)', bob2.log.newMessage.length > 0);

  // 2. fake notification
  alice.emit('sendNotification', { receiverUsername: env.CAROL_NAME, data: { type: 'LIKE', actor: { username: 'fake' } } });
  await sleep(600);
  record('S1', 'a client cannot push a fake notification to carol', carol.log.getNotification.length === 0);

  // 3. typing events
  bob.emit('joinConversation', Number(env.CONV_ID));
  carol.emit('joinConversation', Number(env.CONV_ID));
  alice.emit('joinConversation', Number(env.CONV_ID)); // not a member
  await sleep(500);
  carol.emit('startTyping', { conversationId: Number(env.CONV_ID), username: 'someone_else' });
  await sleep(800);
  record('W', 'member bob receives userTyping', bob.log.userTyping.length > 0);
  record('S1', 'non-member alice does NOT receive userTyping', alice.log.userTyping.length === 0);
  const typed = bob.log.userTyping[0];
  record('S1', 'typing event carries the real username, not the one in the payload', !!typed && typed.username === env.CAROL_NAME);

  // 4. a real notification still arrives: carol follows bob
  const fol = await api('POST', `/api/users/${env.BOB_ID}/follow`, env.CAROL_TOKEN, {});
  await sleep(800);
  record('W', `carol follows bob (HTTP ${fol})`, fol === 200);
  record('W', 'bob receives getNotification', bob.log.getNotification.length > 0);
  // undo the follow so reruns start clean
  await api('POST', `/api/users/${env.BOB_ID}/follow`, env.CAROL_TOKEN, {});

  // 5. logged-out token
  const stale = connect(env.STALE_TOKEN, 'stale');
  const staleUp = await stale.up;
  await sleep(300);
  record('S5', 'a logged-out token cannot keep a socket connection', !staleUp || !stale.connected);

  [alice, bob, bob2, carol, stale].forEach((s) => s.close());
  const failed = results.filter((ok) => !ok).length;
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
