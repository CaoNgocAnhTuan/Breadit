#!/usr/bin/env node
// Demo script for the progress check (task p10-demo-script, design "Approach").
// Run it from the repo root with Node from .nvmrc (`nvm use`) and `docker compose up db redis -d`:
//
//   npm run demo:start   load syn-W2M-M into the schema eval_demo (rebased to now), add the demo admin,
//                        start the backend (run-safe.sh) and the frontend on it, print the URLs and logins
//   npm run demo:users   pick the two demo users and show the first page of each algo for them
//   npm run demo:stop    lift the bans, stop the frontend and the backend, empty Redis database 3
//
// It writes only the schema eval_demo and Redis database 3. It never reads .env, never touches `public`,
// `eval_load` or `it_test`, and never imports app code. The shell's DATABASE_URL and REDIS_URL are ignored.
// The pure parts (rebase time, choice of users, page compare) are in lib.mjs, with tests.
import { spawn, spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedIds, orderCandidates, overlap, pagesNotAllSame, pickUser, rebaseIso } from './lib.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_SAFE = join(ROOT, '.claude', 'hooks', 'run-safe.sh');
const STATE_DIR = join(ROOT, '.claude', 'state', 'demo');
const FRONTEND_PID = join(STATE_DIR, 'frontend.pid');
const FRONTEND_LOG = join(STATE_DIR, 'frontend.log');
const DEMO_JSON = join(STATE_DIR, 'demo.json');

/** The only schema this script loads into or writes SQL to (design F16). */
const SCHEMA = 'eval_demo';
/** The only Redis database it uses: 0 is the dev app, 1 the IT tests, 2 the parity test. */
const REDIS_DB = 3;
const DATASET = 'syn-W2M-M';
const DATABASE_URL = `postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=${SCHEMA}`;
const REDIS_URL = `redis://localhost:6378/${REDIS_DB}`;
const BACKEND_URL = 'http://localhost:4000';
const FRONTEND_URL = 'http://localhost:3000';
const BACKEND_PORT = 4000;
const FRONTEND_PORT = 3000;
const FRONTEND_WAIT_SECONDS = 180;
const PASSWORD = 'password';
const ADMIN = { id: 'demo-admin', username: 'demo_admin', email: 'demo-admin@example.com', displayName: 'Demo admin' };
const ALGOS = ['chrono', 'engagement', 'social'];
const GROUPS = [
  { group: 'little', label: 'little history (1-4)' },
  { group: 'long', label: 'long history (20 or more)' },
];

function fail(message) {
  throw new Error(message);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Docker, SQL, Redis, ports ----------

/** The name of a running compose container (db, redis), as `containerName` of scripts/e7/run-e7.mjs. */
function containerName(service) {
  const r = run('docker', ['ps', '--format', '{{.Names}}']);
  if (r.error || r.status !== 0) fail('Docker does not answer. Start Docker, then: docker compose up db redis -d');
  const re = new RegExp(`(^|[-_])${service}([-_][0-9]+)?$`);
  const name = r.stdout.split('\n').find((n) => re.test(n));
  if (!name) fail(`the ${service} container is not running. Start it: docker compose up db redis -d`);
  return name;
}

/** Runs one SQL text in the db container. Returns the rows as arrays of text fields. */
function psql(sql) {
  const r = run('docker', ['exec', containerName('db'), 'psql', '-U', 'breadit', '-d', 'breadit', '-v', 'ON_ERROR_STOP=1', '-q', '-A', '-t', '-F', '\t', '-c', sql]);
  if (r.status !== 0) fail(`SQL failed: ${(r.stderr || r.stdout || '').trim()}`);
  const text = r.stdout.trimEnd();
  return text === '' ? [] : text.split('\n').map((line) => line.split('\t'));
}

function redisFlush() {
  const r = run('docker', ['exec', containerName('redis'), 'redis-cli', '-n', String(REDIS_DB), 'FLUSHDB']);
  if (r.status !== 0) fail(`FLUSHDB of Redis database ${REDIS_DB} failed: ${(r.stderr || r.stdout).trim()}`);
}

/** The lsof lines of what listens on a port, or '' when the port is free. */
function listeners(port) {
  const r = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  return r.status === 0 ? r.stdout.trim() : '';
}

const portFree = (port) => listeners(port) === '';

/** A UTC timestamp literal for a column of type TIMESTAMP(3), from a `YYYY-MM-DDTHH:MM:SSZ` text of rebaseIso. */
function sqlTime(iso) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(iso)) fail(`not a rebase time: ${iso}`);
  return `('${iso}'::timestamptz AT TIME ZONE 'UTC')`;
}

// ---------- HTTP ----------

async function waitFor(url, seconds, isDead = () => false) {
  const until = Date.now() + seconds * 1000;
  while (Date.now() < until) {
    if (isDead()) return false;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      await res.text();
      if (res.status === 200) return true;
    } catch {
      // not up yet
    }
    await sleep(1000);
  }
  return false;
}

/** Signs in through the API. Returns the cookie ("breadit_session=...") and the user. */
async function login(email) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.text();
  if (res.status === 429) fail(`login of ${email} answered 429: the limit is 10 logins per minute per IP. Wait one minute, then run it again`);
  const line = res.headers.getSetCookie().find((c) => c.startsWith('breadit_session='));
  if (res.status !== 200 || !line) fail(`login of ${email} answered ${res.status}: ${body.slice(0, 200)}`);
  return { cookie: line.split(';')[0], user: JSON.parse(body).user };
}

/** The first page (10 posts) of For You with one algo, as the JSON body. */
async function firstPage(cookie, algo) {
  const res = await fetch(`${BACKEND_URL}/api/posts?algo=${algo}`, { headers: { cookie } });
  const text = await res.text();
  if (res.status !== 200) fail(`GET /api/posts?algo=${algo} answered ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

// ---------- the frontend and the backend ----------

/** Only what start launched is ever stopped by it (design: start cleanup). */
const launched = { backend: false, frontend: false };

function serverEnv() {
  const env = { ...process.env };
  // Whatever could change the feed, the ports or the target: the script's own values win (design F4).
  for (const k of ['FEED_DEFAULT_ALGO', 'FEED_ASOF_ENABLED', 'REDIS_HTTP_CACHE_ENABLED', 'THROTTLE_LIMIT', 'NODE_ENV', 'JWT_SECRET', 'FRONTEND_URL', 'COOKIE_DOMAIN', 'PARITY_DATABASE_URL', 'PARITY_REDIS_URL', 'PORT']) {
    delete env[k];
  }
  return { ...env, DATABASE_URL, REDIS_URL };
}

function stopBackend() {
  const r = run('bash', [RUN_SAFE, 'stop']);
  const text = r.stdout.trim();
  console.log(text.includes('not running') ? 'backend: nothing to do' : `backend: ${text}`);
}

function readFrontendPid() {
  if (!existsSync(FRONTEND_PID)) return null;
  const pid = Number.parseInt(readFileSync(FRONTEND_PID, 'utf8').trim(), 10);
  return Number.isInteger(pid) && pid > 1 ? pid : null;
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The pid is ours when it is the leader of its process group and runs npm or next (a stale pid file must not kill a stranger). */
function isDemoFrontend(pid) {
  const r = run('ps', ['-o', 'pgid=,command=', '-p', String(pid)]);
  if (r.status !== 0) return false;
  const m = r.stdout.trim().match(/^(\d+)\s+(.*)$/);
  return m !== null && Number(m[1]) === pid && /\b(npm|next)\b/.test(m[2]);
}

/** Kills the process group of the frontend, then checks that :3000 is free. Returns false when it is not. */
async function stopFrontend() {
  const pid = readFrontendPid();
  if (pid !== null && alive(pid) && isDemoFrontend(pid)) {
    const killGroup = (signal) => {
      try {
        process.kill(-pid, signal);
      } catch {
        // the group is already gone
      }
    };
    killGroup('SIGTERM');
    for (let i = 0; i < 20 && (alive(pid) || !portFree(FRONTEND_PORT)); i += 1) await sleep(500);
    if (alive(pid) || !portFree(FRONTEND_PORT)) {
      killGroup('SIGKILL');
      for (let i = 0; i < 10 && !portFree(FRONTEND_PORT); i += 1) await sleep(500);
    }
    console.log(`frontend: stopped (process group ${pid})`);
  } else {
    console.log('frontend: nothing to do');
  }
  rmSync(FRONTEND_PID, { force: true });
  const left = listeners(FRONTEND_PORT);
  if (left !== '') {
    console.error(`port ${FRONTEND_PORT} is still in use (F14). Find it and stop it by hand:\n${left}`);
    return false;
  }
  return true;
}

function startFrontend() {
  mkdirSync(STATE_DIR, { recursive: true });
  const log = openSync(FRONTEND_LOG, 'w');
  launched.frontend = true;
  const child = spawn('npm', ['run', 'dev', '-w', '@breadit/frontend', '--', '-p', String(FRONTEND_PORT)], {
    cwd: ROOT,
    detached: true, // its own process group, so stop can kill next dev and its children (F14)
    stdio: ['ignore', log, log],
    env: { ...serverEnv(), BACKEND_INTERNAL_URL: BACKEND_URL, NEXT_PUBLIC_BACKEND_URL: BACKEND_URL },
  });
  closeSync(log);
  writeFileSync(FRONTEND_PID, `${child.pid}\n`, 'utf8');
  child.unref();
  const state = { dead: false };
  child.on('exit', () => {
    state.dead = true;
  });
  return state;
}

// ---------- the users command ----------

function historyQuery(rebaseTime) {
  const t = sqlTime(rebaseTime);
  return `
WITH h AS (
  SELECT "userId" AS uid, count(*) AS n FROM ${SCHEMA}."Like" WHERE "createdAt" < ${t} GROUP BY 1
  UNION ALL
  SELECT "userId", count(*) FROM ${SCHEMA}."Comment" WHERE "deletedAt" IS NULL AND "createdAt" < ${t} GROUP BY 1
  UNION ALL
  SELECT "userId", count(*) FROM ${SCHEMA}."Post" WHERE "rePostId" IS NOT NULL AND "createdAt" < ${t} GROUP BY 1
), hist AS (
  SELECT uid, sum(n) AS history FROM h GROUP BY uid
), fol AS (
  SELECT "followerId" AS uid, count(*) AS follows FROM ${SCHEMA}."Follow" GROUP BY 1
)
SELECT u.id, u.username, u.email, coalesce(hist.history, 0), coalesce(fol.follows, 0)
FROM ${SCHEMA}."User" u
LEFT JOIN hist ON hist.uid = u.id
LEFT JOIN fol ON fol.uid = u.id
WHERE u.id <> '${ADMIN.id}'
ORDER BY u.id`;
}

/**
 * Picks the two demo users (design: users steps 1-3). Returns { little, long }, each with the user's row,
 * the three first pages (`ids`) and the cookie of its login. Stops with a message naming the group when none passes (F10).
 */
async function chooseUsers(rebaseTime) {
  const rows = psql(historyQuery(rebaseTime)).map(([id, username, email, history, follows]) => ({
    id,
    username,
    email,
    history: Number(history),
    follows: Number(follows),
  }));
  const chosen = {};
  for (const { group, label } of GROUPS) {
    const candidates = orderCandidates(rows, group);
    if (candidates.length === 0) fail(`no user with ${label} and at least one follow in ${SCHEMA}`);
    const { chosen: user, result, skipped } = await pickUser(candidates, async (c) => {
      const { cookie } = await login(c.email);
      const ids = {};
      for (const algo of ALGOS) ids[algo] = feedIds(await firstPage(cookie, algo));
      const short = ALGOS.filter((a) => ids[a].length < 10);
      if (short.length > 0) return { ok: false, reason: `fewer than 10 posts on ${short.join(', ')}` };
      if (!pagesNotAllSame(ALGOS.map((a) => ids[a]))) return { ok: false, reason: 'the three algo pages have the same order' };
      return { ok: true, cookie, ids };
    });
    for (const s of skipped) console.log(`  skipped ${s.candidate.username} (${group}): ${s.reason}`);
    if (user === null) {
      fail(`no user of the group "${group}" (${label}) passes. Tried: ${skipped.map((s) => `${s.candidate.username} (${s.reason})`).join('; ')}`);
    }
    chosen[group] = { ...user, ids: result.ids, cookie: result.cookie };
  }
  return chosen;
}

function printUsers(users) {
  for (const { group, label } of GROUPS) {
    const u = users[group];
    console.log(`${label}: ${u.username}  (${u.email} / ${PASSWORD})`);
    console.log(`  history ${u.history}, follows ${u.follows}`);
    for (const algo of ALGOS) console.log(`  ${algo.padEnd(10)} ${u.ids[algo].join(' ')}`);
    console.log(`  social shares ${overlap(u.ids.social, u.ids.chrono)} of ${u.ids.social.length} with chrono and ${overlap(u.ids.social, u.ids.engagement)} of ${u.ids.social.length} with engagement`);
  }
}

function readDemoState() {
  if (!existsSync(DEMO_JSON)) fail('there is no demo state (.claude/state/demo/demo.json). Run: npm run demo:start');
  return JSON.parse(readFileSync(DEMO_JSON, 'utf8'));
}

async function usersCommand() {
  const state = readDemoState();
  if (!(await waitFor(`${BACKEND_URL}/api/health`, 3))) fail('the backend does not answer on :4000. Run: npm run demo:start');
  const users = await chooseUsers(state.rebaseTime);
  printUsers(users);
}

// ---------- start ----------

function checks() {
  // Everything here runs before anything is written (design: start step 1, F1, F2, F3, F17).
  if (process.versions.node.split('.')[0] !== '22') fail(`Node ${process.version} is not Node 22. Run "nvm use" in the repo root first.`);
  if (run('docker', ['ps']).status !== 0) fail('Docker does not answer. Start Docker, then: docker compose up db redis -d');
  containerName('db');
  containerName('redis');
  for (const [port, how] of [
    [FRONTEND_PORT, 'Stop it (for example the dev server of npm run dev). If it is a frontend of this demo, run: npm run demo:stop'],
    [BACKEND_PORT, 'Stop it (for example: bash .claude/hooks/run-safe.sh stop)'],
  ]) {
    const l = listeners(port);
    if (l !== '') fail(`port ${port} is in use. The demo starts its own server and never reuses one, because it does not know the schema of the old one. ${how}\n${l}`);
  }
  const status = run('bash', [RUN_SAFE, 'status']).stdout.trim();
  if (!status.includes('not running')) fail(`a backend of run-safe.sh is running. Stop it: bash .claude/hooks/run-safe.sh stop\n${status}`);
  if (!existsSync(join(ROOT, 'eval', 'data', DATASET, 'manifest.json'))) fail(`eval/data/${DATASET}/ does not exist. Run: npm run gen -w @breadit/eval`);
}

function step(text) {
  console.log(`\n== ${text} ==`);
}

async function warmUp(label, path, cookie) {
  const t = Date.now();
  try {
    const res = await fetch(`${FRONTEND_URL}${path}`, { headers: cookie ? { cookie } : {}, signal: AbortSignal.timeout(120_000) });
    await res.text();
    const seconds = ((Date.now() - t) / 1000).toFixed(1);
    console.log(`  ${res.status === 200 ? 'ok  ' : 'WARN'} ${label.padEnd(22)} ${res.status}  ${seconds} s`);
  } catch (e) {
    console.log(`  WARN ${label.padEnd(22)} ${e.message}`);
  }
}

async function startCommand() {
  const started = Date.now();
  checks();
  mkdirSync(STATE_DIR, { recursive: true });
  try {
    step('build @breadit/shared and @breadit/ranking');
    for (const w of ['@breadit/shared', '@breadit/ranking']) {
      const b = run('npm', ['run', 'build', '-w', w]);
      if (b.status !== 0) fail(`build of ${w} failed:\n${(b.stdout + b.stderr).slice(-2000)}`);
    }

    // The script reads the clock; eval/ never does, so the time goes to the loader as an argument.
    const rebaseTime = rebaseIso(new Date());
    step(`load ${DATASET} into ${SCHEMA}, rebased to ${rebaseTime}`);
    const load = run('npm', ['run', 'load', '-w', '@breadit/eval', '--', DATASET, '--schema', SCHEMA, '--rebase-to', rebaseTime], {
      env: { ...serverEnv() },
    });
    if (load.status !== 0) fail(`the load failed (nothing else was started):\n${(load.stdout + load.stderr).trim()}`);
    console.log(load.stdout.trim());

    step('admin account');
    const t = sqlTime(rebaseTime);
    const added = psql(
      `INSERT INTO ${SCHEMA}."User" (id, email, username, password, "emailVerified", "displayName", role, banned, "createdAt", "updatedAt")
       SELECT '${ADMIN.id}', '${ADMIN.email}', '${ADMIN.username}', password, ${t}, '${ADMIN.displayName}', 'ADMIN', false, ${t}, ${t}
       FROM ${SCHEMA}."User" WHERE id <> '${ADMIN.id}' LIMIT 1
       RETURNING id`,
    );
    if (added.length !== 1 || added[0][0] !== ADMIN.id) fail(`the admin was not added: ${SCHEMA}."User" has no loaded user to copy the password from`);
    console.log(`added ${ADMIN.username} (role ADMIN)`);

    step(`Redis database ${REDIS_DB}: empty`);
    redisFlush();

    step(`backend on :${BACKEND_PORT} (run-safe.sh, ${SCHEMA}, Redis database ${REDIS_DB})`);
    launched.backend = true;
    const b = run('bash', [RUN_SAFE, 'start'], { env: serverEnv(), stdio: 'inherit' });
    if (b.status !== 0) fail('the backend did not start (see the output above)');

    step(`frontend on :${FRONTEND_PORT} (next dev)`);
    const fe = startFrontend();
    if (!(await waitFor(`${FRONTEND_URL}/sign-in`, FRONTEND_WAIT_SECONDS, () => fe.dead))) {
      const log = existsSync(FRONTEND_LOG) ? readFileSync(FRONTEND_LOG, 'utf8').split('\n').slice(-30).join('\n') : '(no log)';
      fail(`the frontend did not answer 200 on /sign-in within ${FRONTEND_WAIT_SECONDS} s${fe.dead ? ' (it exited)' : ''}. Last lines of ${FRONTEND_LOG}:\n${log}`);
    }
    console.log('frontend answers on /sign-in');

    step('demo users');
    const users = await chooseUsers(rebaseTime);
    printUsers(users);

    // A page is compiled on its first request. A real session is needed, because the middleware sends everyone else to /sign-in.
    // Design says `/explore`, but Explore is `/?feed=explore` (a tab of `/`), so the pages of the checklist are warmed here.
    step('warm-up of the pages (first compile)');
    const admin = await login(ADMIN.email);
    const own = users.long.cookie;
    await warmUp('/sign-in', '/sign-in');
    await warmUp('/', '/', own);
    await warmUp('/?feed=explore', '/?feed=explore', own);
    await warmUp(`/${users.long.username}`, `/${users.long.username}`, own);
    await warmUp('/messages', '/messages', own);
    await warmUp('/notifications', '/notifications', own);
    await warmUp('/admin-console', '/admin-console', admin.cookie);
    await warmUp('/admin-console/users', '/admin-console/users', admin.cookie);

    const strip = ({ id, username, email, history, follows, ids }) => ({ id, username, email, history, follows, ids });
    writeFileSync(
      DEMO_JSON,
      `${JSON.stringify({ rebaseTime, schema: SCHEMA, redisDatabase: REDIS_DB, dataset: DATASET, admin: ADMIN, users: { little: strip(users.little), long: strip(users.long) } }, null, 2)}\n`,
      'utf8',
    );

    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`
== the demo is up (start took ${seconds} s) ==
rebase time : ${rebaseTime}   (the newest post is at this time; run start close to the demo)
schema      : ${SCHEMA}   Redis database: ${REDIS_DB}
frontend    : ${FRONTEND_URL}
backend     : ${BACKEND_URL}
admin       : ${ADMIN.email} (username ${ADMIN.username}) / ${PASSWORD}
user, long history  (${users.long.history}, ${users.long.follows} follows)  : ${users.long.email} (${users.long.username}) / ${PASSWORD}
user, little history (${users.little.history}, ${users.little.follows} follows) : ${users.little.email} (${users.little.username}) / ${PASSWORD}
state       : ${DEMO_JSON.replace(`${ROOT}/`, '')}
checklist: scripts/demo/CHECKLIST.md
stop: npm run demo:stop`);
  } catch (e) {
    console.error(`\ndemo:start failed: ${e.message}`);
    console.error('stopping what start launched...');
    if (launched.frontend) await stopFrontend();
    if (launched.backend) stopBackend();
    process.exitCode = 1;
  }
}

// ---------- stop ----------

async function stopCommand() {
  let ok = true;

  // 1. Bans, by SQL: no login, and it works when the backend is already down (F13).
  try {
    const unbanned = psql(`UPDATE ${SCHEMA}."User" SET banned = false WHERE banned RETURNING username`);
    console.log(unbanned.length === 0 ? 'bans: nothing to do' : `bans: lifted for ${unbanned.map((r) => r[0]).join(', ')}`);
  } catch (e) {
    const text = e.message;
    if (/does not exist/.test(text)) console.log(`bans: nothing to do (${SCHEMA} does not exist yet)`);
    else console.log(`bans: skipped (${text.split('\n')[0]}). The next start loads ${SCHEMA} again, so no ban stays`);
  }

  // 2. Frontend, 3. backend, 4. Redis.
  if (!(await stopFrontend())) ok = false;
  stopBackend();
  try {
    redisFlush();
    console.log(`redis: database ${REDIS_DB} emptied`);
  } catch (e) {
    console.log(`redis: nothing to do (${e.message.split('\n')[0]})`);
  }

  // 5. The schema stays: the next start empties it.
  console.log(`${SCHEMA} is kept; the next start empties it`);
  if (!ok) process.exitCode = 1;
}

// ---------- main ----------

const COMMANDS = { start: startCommand, users: usersCommand, stop: stopCommand };
const command = process.argv[2];
if (!COMMANDS[command]) {
  console.error('usage: node scripts/demo/demo.mjs <start|users|stop>   (npm run demo:start | demo:users | demo:stop)');
  process.exit(2);
}
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    if (command === 'start') {
      console.error(`\n${sig}: stopping what start launched...`);
      if (launched.frontend) await stopFrontend();
      if (launched.backend) stopBackend();
    }
    process.exit(130);
  });
}
try {
  await COMMANDS[command]();
} catch (e) {
  console.error(`\ndemo:${command} failed: ${e.message}`);
  process.exitCode = 1;
}
