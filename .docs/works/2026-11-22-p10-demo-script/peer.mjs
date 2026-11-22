#!/usr/bin/env node
// The "other window" for the rehearsal of the demo (task folder .docs/works/2026-11-22-p10-demo-script/).
// It is not part of the demo. The Chrome extension has one cookie jar, so window B is this script.
// Based on .docs/works/2026-11-20-p10-demo-sweep/second-user.mjs, with the account taken from an argument.
//
// Run it from the repo root, one action per call, after `npm run demo:start`:
//   node .docs/works/2026-11-22-p10-demo-script/peer.mjs <account> <command> [args]
//
// <account>: a user of eval_demo by username or email (u0000000787, u0000000787@example.com), or demo_admin.
//            The password is always "password".
// Commands:
//   dm <conversationId|username> <text>   send a message; with a username it finds or creates the conversation first
//   typing <conversationId>               join the conversation room, show "typing" for about 3 s, then stop (Socket.IO)
//   like <postId>                         toggle the like of a post (a second call undoes it)
//   ban <userId> [--force]                the account (must be demo_admin) bans a user: it logs the user out
//   unban <userId>                        the account (must be demo_admin) lifts the ban
//
// Env: BASE_URL (default http://localhost:4000).
// It signs in once per run (login is limited to 10 per minute per IP), keeps the cookie in memory and prints the HTTP
// status of every call. ban refuses the demo admin always (R6: an admin can ban themselves), and the two demo users of
// .claude/state/demo/demo.json unless --force is given (the ban step of the checklist bans the little user on purpose).
// unban has no such limit, so the cleanup can always lift a ban.
// Only Node built-ins plus socket.io-client (found in the repo root node_modules).
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.BASE_URL ?? 'http://localhost:4000').replace(/\/+$/, '');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const PASSWORD = 'password';
const ADMIN = { id: 'demo-admin', username: 'demo_admin', email: 'demo-admin@example.com' };

let cookie = '';
let failed = false;

function short(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

function report(res, label) {
  if (res.status >= 400) failed = true;
  console.log(`HTTP ${res.status} ${label}  ${short(res.data)}`);
}

function emailOf(account) {
  if (account.includes('@')) return account;
  if (account === ADMIN.username) return ADMIN.email;
  return `${account}@example.com`;
}

async function request(method, path, { json, form, auth = true } = {}) {
  const headers = {};
  if (auth && cookie) headers.cookie = cookie;
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

async function login(account) {
  if (cookie) return;
  const email = emailOf(account);
  const res = await request('POST', '/api/auth/login', { json: { email, password: PASSWORD }, auth: false });
  report({ status: res.status, data: res.data?.user ? { user: res.data.user.username } : res.data }, `POST /api/auth/login (${account})`);
  const line = res.headers.getSetCookie().find((c) => c.startsWith('breadit_session='));
  if (res.status !== 200 || !line) {
    console.error(`login of ${account} failed (login is limited to 10 per minute per IP; wait one minute on 429)`);
    process.exit(1);
  }
  cookie = line.split(';')[0];
}

async function call(account, method, path, opts) {
  await login(account);
  const res = await request(method, path, opts);
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

async function userIdOf(account, username) {
  const res = await call(account, 'GET', `/api/users/${encodeURIComponent(username)}`);
  if (res.status !== 200 || !res.data?.id) throw new Error(`user ${username} not found`);
  return res.data.id;
}

const commands = {
  async dm(account, target, ...words) {
    const usage = 'dm <conversationId|username> <text>';
    need(target, usage);
    const text = need(words.join(' '), usage);
    let conversationId;
    if (isNumber(target)) {
      conversationId = Number(target);
    } else {
      const targetUserId = await userIdOf(account, target);
      const conv = await call(account, 'POST', '/api/conversations', { json: { targetUserId } });
      if (conv.status >= 400) return;
      conversationId = conv.data.id;
    }
    await call(account, 'POST', `/api/conversations/${conversationId}/messages`, { json: { body: text } });
    console.log(`conversationId=${conversationId}`);
  },

  async typing(account, conversationArg) {
    const conversationId = Number(need(conversationArg, 'typing <conversationId>'));
    await login(account);
    const { io } = await import('socket.io-client');
    const socket = io(BASE, { extraHeaders: { cookie }, transports: ['websocket'], reconnection: false });
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const connected = await new Promise((resolveConnected) => {
      socket.on('connect', () => resolveConnected(true));
      socket.on('connect_error', (e) => resolveConnected(e.message));
      setTimeout(() => resolveConnected('timeout'), 4000);
    });
    if (connected !== true) {
      console.error(`socket did not connect: ${connected}`);
      socket.close();
      process.exit(1);
    }
    console.log(`socket connected as ${account} (id ${socket.id})`);
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

  async like(account, postArg) {
    const postId = need(postArg, 'like <postId>');
    await call(account, 'POST', `/api/posts/${Number(postId)}/like`);
  },

  async ban(account, userId, flag) {
    await banOrUnban(account, 'ban', need(userId, 'ban <userId> [--force]'), flag === '--force');
  },

  async unban(account, userId) {
    await banOrUnban(account, 'unban', need(userId, 'unban <userId>'), true);
  },
};

/** The ids and usernames of the two demo users, from the state file of demo:start. */
function demoUsers() {
  const file = join(ROOT, '.claude', 'state', 'demo', 'demo.json');
  if (!existsSync(file)) return [];
  const state = JSON.parse(readFileSync(file, 'utf8'));
  return Object.values(state.users ?? {}).map((u) => ({ id: u.id, username: u.username }));
}

async function banOrUnban(account, action, target, force) {
  if (action === 'ban') {
    if (target === ADMIN.id || target === ADMIN.username) {
      console.error(`refused: ${target} is the demo admin; the rehearsal never bans the admin (R6)`);
      process.exit(2);
    }
    const isDemoUser = demoUsers().some((u) => u.id === target || u.username === target);
    if (isDemoUser && !force) {
      console.error(`refused: ${target} is one of the two demo users; add --force to ban it on purpose (checklist step 6), and unban it after`);
      process.exit(2);
    }
  }
  await call(account, 'POST', `/api/admin/users/${encodeURIComponent(target)}/${action}`);
}

const [account, command, ...args] = process.argv.slice(2);
if (!account || !command || !commands[command]) {
  console.error(`usage: node peer.mjs <account> <${Object.keys(commands).join('|')}> [args]\n  account: a username or email of eval_demo, or demo_admin (password: ${PASSWORD})`);
  process.exit(command || account ? 2 : 0);
}
try {
  await commands[command](account, ...args);
} catch (err) {
  console.error(`error: ${err.message}`);
  process.exit(1);
}
process.exit(failed ? 1 : 0);
