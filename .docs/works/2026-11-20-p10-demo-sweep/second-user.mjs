#!/usr/bin/env node
// Second user for the p10 demo sweep (task folder .docs/works/2026-11-20-p10-demo-sweep/).
//
// Run it from the repo root, one action per call:
//   node .docs/works/2026-11-20-p10-demo-sweep/second-user.mjs <command> [args]
//
// Commands (user2 acts, except ban and unban, where admin acts):
//   dm <conversationId|username> <text>     send a message; with a username it finds or
//                                           creates the user2 conversation first
//   typing <conversationId>                 join the conversation room, show "typing" for
//                                           about 3 s, then stop (Socket.IO)
//   like <postId>                           toggle the like of a post (a second call undoes it)
//   join <communityId|slug>                 toggle the membership (a second call leaves)
//   post-in-community <communityId> <text>  post in a community (pending if user2 is a member)
//   ban <userId> [--force]                  admin bans a user (logs the user out)
//   unban <userId>                          admin lifts the ban
//
// Env: BASE_URL (default http://localhost:4000).
// It signs in only the user a command needs, once per run (login is limited to 10 per
// minute per IP). It keeps the cookie in memory and prints the HTTP status of every call.
// ban refuses admin always, and user1 and user2 unless --force is given (the W13 flow bans
// user1 on purpose). unban has no such limit, so the cleanup can always lift a ban.
// Only Node built-ins plus socket.io-client (found in the repo root node_modules).

const BASE = (process.env.BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');

const ACCOUNTS = {
  user2: { email: 'user2@example.com', password: 'password' },
  admin: { email: 'admin@breadit.dev', password: '123456' },
};
const NEVER_BAN = ['admin']; // R6: an admin can ban themselves
const BAN_NEEDS_FORCE = ['user1', 'user2'];

const cookies = {}; // who -> "breadit_session=<token>"
let failed = false;

function short(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function report(res, label) {
  if (res.status >= 400) failed = true;
  console.log(`HTTP ${res.status} ${label}  ${short(res.data)}`);
}

async function request(who, method, path, { json, form } = {}) {
  const headers = {};
  if (who) headers.cookie = cookies[who];
  let body;
  if (form) {
    body = form; // fetch sets the multipart boundary itself
  } else if (method !== 'GET') {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(json ?? {}); // Fastify refuses an empty JSON body
  }
  const res = await fetch(BASE + path, { method, headers, body });
  const text = await res.text();
  let data = text;
  try {
    data = JSON.parse(text);
  } catch {
    // not JSON: keep the text
  }
  return { status: res.status, data, headers: res.headers };
}

async function login(who) {
  if (cookies[who]) return;
  const { email, password } = ACCOUNTS[who];
  const res = await request(null, 'POST', '/api/auth/login', { json: { email, password } });
  report({ status: res.status, data: res.data?.user ? { user: res.data.user.username } : res.data }, `POST /api/auth/login (${who})`);
  const line = res.headers.getSetCookie().find((c) => c.startsWith('breadit_session='));
  if (res.status !== 200 || !line) {
    console.error(`login of ${who} failed (login is limited to 10 per minute per IP; wait one minute on 429)`);
    process.exit(1);
  }
  cookies[who] = line.split(';')[0];
}

async function call(who, method, path, opts) {
  await login(who);
  const res = await request(who, method, path, opts);
  report(res, `${method} ${path}`);
  return res;
}

function need(value, usage) {
  if (value === undefined || value === '') {
    console.error(`usage: ${usage}`);
    process.exit(2);
  }
  return value;
}

const isNumber = (s) => /^\d+$/.test(s);

async function userIdOf(username) {
  const res = await call('user2', 'GET', `/api/users/${encodeURIComponent(username)}`);
  if (res.status !== 200 || !res.data?.id) throw new Error(`user ${username} not found`);
  return res.data.id;
}

async function communityIdOf(ref) {
  if (isNumber(ref)) return Number(ref);
  const res = await call('user2', 'GET', `/api/communities/${encodeURIComponent(ref)}`);
  if (res.status !== 200 || !res.data?.id) throw new Error(`community ${ref} not found`);
  return res.data.id;
}

const commands = {
  async dm(target, ...words) {
    const usage = 'dm <conversationId|username> <text>';
    need(target, usage);
    const text = need(words.join(' '), usage);
    let conversationId;
    if (isNumber(target)) {
      conversationId = Number(target);
    } else {
      const targetUserId = await userIdOf(target);
      const conv = await call('user2', 'POST', '/api/conversations', { json: { targetUserId } });
      if (conv.status >= 400) return;
      conversationId = conv.data.id;
    }
    await call('user2', 'POST', `/api/conversations/${conversationId}/messages`, { json: { body: text } });
    console.log(`conversationId=${conversationId}`);
  },

  async typing(conversationArg) {
    const conversationId = Number(need(conversationArg, 'typing <conversationId>'));
    await login('user2');
    const { io } = await import('socket.io-client');
    const socket = io(BASE, {
      extraHeaders: { cookie: cookies.user2 },
      transports: ['websocket'],
      reconnection: false,
    });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const connected = await new Promise((resolve) => {
      socket.on('connect', () => resolve(true));
      socket.on('connect_error', (e) => resolve(e.message));
      setTimeout(() => resolve('timeout'), 4000);
    });
    if (connected !== true) {
      console.error(`socket did not connect: ${connected}`);
      socket.close();
      process.exit(1);
    }
    console.log(`socket connected as user2 (id ${socket.id})`);
    // The gateway sends no reply to these events, so there is no status to print.
    socket.emit('joinConversation', conversationId);
    await sleep(400);
    socket.emit('startTyping', { conversationId });
    console.log(`emitted startTyping for conversation ${conversationId}, waiting 3 s`);
    await sleep(3000);
    socket.emit('stopTyping', { conversationId });
    console.log('emitted stopTyping');
    await sleep(300);
    socket.close();
  },

  async like(postArg) {
    const postId = need(postArg, 'like <postId>');
    await call('user2', 'POST', `/api/posts/${Number(postId)}/like`);
  },

  async join(ref) {
    const communityId = await communityIdOf(need(ref, 'join <communityId|slug>'));
    await call('user2', 'POST', `/api/communities/${communityId}/join`);
  },

  async 'post-in-community'(communityArg, ...words) {
    const usage = 'post-in-community <communityId> <text>';
    const communityId = need(communityArg, usage);
    const text = need(words.join(' '), usage);
    const form = new FormData();
    form.append('desc', text);
    form.append('communityId', String(communityId));
    await call('user2', 'POST', '/api/posts', { form });
  },

  async ban(userId, flag) {
    await banOrUnban('ban', need(userId, 'ban <userId> [--force]'), flag === '--force');
  },

  async unban(userId) {
    await banOrUnban('unban', need(userId, 'unban <userId>'), true);
  },
};

async function banOrUnban(action, userId, force) {
  if (action === 'ban') {
    // The ids are read from the API, not guessed.
    for (const name of [...NEVER_BAN, ...BAN_NEEDS_FORCE]) {
      const res = await request(null, 'GET', `/api/users/${name}`);
      const isIt = name === userId || (res.status === 200 && res.data?.id === userId);
      if (!isIt) continue;
      if (NEVER_BAN.includes(name)) {
        console.error(`refused: ${userId} is ${name}, the sweep never bans ${name}`);
        process.exit(2);
      }
      if (!force) {
        console.error(`refused: ${userId} is ${name}; add --force to ban it on purpose (flow W13), and unban it after`);
        process.exit(2);
      }
    }
  }
  await call('admin', 'POST', `/api/admin/users/${encodeURIComponent(userId)}/${action}`);
}

const [command, ...args] = process.argv.slice(2);
if (!command || !commands[command]) {
  console.error(`usage: node second-user.mjs <${Object.keys(commands).join('|')}> [args]`);
  process.exit(command ? 2 : 0);
}
try {
  await commands[command](...args);
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}
process.exit(failed ? 1 : 0);
