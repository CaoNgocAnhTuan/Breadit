#!/usr/bin/env node
// E7 runner (task p7-cost-benchmark, design "Approach", step 2 and "Workflow"). Run it with `npm run bench:e7` from the repo root,
// with Node from .nvmrc (`nvm use`), `docker compose up db redis -d` and `syn-W2M-M` loaded into `eval_load` without --rebase-to.
//
//   1. the prepare step (Jest project `bench` of the backend): counts the Prisma queries per request, makes the session cookies;
//   2. the backend is started with .claude/hooks/run-safe.sh: schema eval_load, page cache off, `asOf` on, Redis database 3;
//   3. 5 rounds x 3 algos of k6 runs (round 1 is warm-up), the algos in rotated order. One failed request stops everything;
//   4. the backend is stopped (always), runs.csv and environment.json are written, and `npm run e7:summary -w @breadit/eval`
//      writes the results to .docs/results/p7-e7/.
//
// Options: --throttle-limit <n>  THROTTLE_LIMIT of the backend (default 1000000; use 50 to see the gate stop a run)
//          --rounds <n>          rounds of 3 runs (default 5; the summary needs 5, fewer is for trying the runner)
// It never imports app code, and it never reuses a backend that already runs (its env is unknown).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, arch, loadavg, release, totalmem, type as osType } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RAW_DIR = join(ROOT, 'eval', 'results', 'p7-e7');
const K6_DIR = join(RAW_DIR, 'k6');
const RUN_SAFE = join(ROOT, '.claude', 'hooks', 'run-safe.sh');
const PAIRS = join(ROOT, '.docs', 'results', 'p6-parity', 'pairs.csv');

const ALGOS = ['chrono', 'engagement', 'social'];
const ITERATIONS = 100;
/** The same test secret for the prepare step (it signs the cookies) and the backend (it checks them): design F6. */
const JWT_SECRET = 'e7-bench-secret-e7-bench-secret-0123456789';
const DATABASE_URL = 'postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=eval_load';
/** Database 3 is only for the E7 backend: the dev counters in 0, the IT tests in 1 and the parity test in 2 stay as they are. */
const REDIS_DB = 3;
const REDIS_URL = `redis://localhost:6378/${REDIS_DB}`;
const BASE_URL = 'http://127.0.0.1:4000';
const RUNS_HEADER = ['round', 'algo', 'warmup', 'requests', 'failed', 'min_ms', 'median_ms', 'p95_ms', 'max_ms'];
const LOAD_PROFILE = {
  executor: 'shared-iterations',
  vus: 1,
  iterations: ITERATIONS,
  sleep: 'none',
  request: 'GET /api/posts?algo=<algo>&asOf=<as_of_unix of the pair>, page 1',
  order: 'the 100 pairs of .docs/results/p6-parity/pairs.csv, in file order',
  rounds: 5,
  warmupRounds: 1,
  algoOrder: 'rotated by one algo each round (round 1: chrono, engagement, social)',
};

function fail(message) {
  throw new Error(message);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
}

/** stdout of a command, trimmed. Stops with a message when the command fails and `required` is set. */
function out(cmd, args, what, required = true) {
  const r = run(cmd, args);
  if (r.error || r.status !== 0) {
    if (required) fail(`${what} failed: ${cmd} ${args.join(' ')}${r.error ? ` (${r.error.message})` : ''}\n${r.stderr ?? ''}`);
    return 'unknown';
  }
  return r.stdout.trim();
}

function rotate(round) {
  return ALGOS.map((_, i) => ALGOS[(i + round - 1) % ALGOS.length]);
}

function containerName(service) {
  const names = out('docker', ['ps', '--format', '{{.Names}}'], 'docker ps').split('\n');
  const re = new RegExp(`(^|[-_])${service}([-_][0-9]+)?$`);
  const name = names.find((n) => re.test(n));
  if (!name) fail(`the ${service} container is not running. Start it: docker compose up db redis -d`);
  return name;
}

function checks() {
  // F10: k6, Docker and Node first, before any work.
  const pinned = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim();
  if (process.version !== pinned) fail(`Node ${process.version} is not the version in .nvmrc (${pinned}). Run "nvm use" in the repo root first.`);
  if (run('k6', ['version']).status !== 0) fail('k6 is not installed or not on PATH (brew install k6)');
  if (run('docker', ['ps']).status !== 0) fail('Docker does not answer. Start Docker, then: docker compose up db redis -d');
  const db = containerName('db');
  const redis = containerName('redis');
  // F2: a backend that already runs has an unknown env (cache on? schema public?), so it is never reused.
  const listen = run('lsof', ['-nP', '-iTCP:4000', '-sTCP:LISTEN']);
  if (listen.status === 0 && listen.stdout.trim() !== '') {
    fail(`port 4000 is in use. E7 starts its own backend and never reuses one. Stop it: bash .claude/hooks/run-safe.sh stop\n${listen.stdout}`);
  }
  const status = out('bash', [RUN_SAFE, 'status'], 'run-safe.sh status');
  if (!status.includes('not running')) fail(`a backend of run-safe.sh is running. Stop it: bash .claude/hooks/run-safe.sh stop\n${status}`);
  return { db, redis };
}

/** The env of the prepare step and the backend: the shell env without what could change the feed, plus the E7 values. */
function baseEnv() {
  const env = { ...process.env };
  for (const k of ['FEED_DEFAULT_ALGO', 'REDIS_HTTP_CACHE_ENABLED', 'NODE_ENV', 'PARITY_DATABASE_URL', 'PARITY_REDIS_URL']) delete env[k];
  return env;
}

/** Set before the runner starts its backend. Only a backend the runner started is ever stopped by it. */
let backendStarted = false;

function stopBackend() {
  if (!backendStarted) return;
  backendStarted = false;
  const r = run('bash', [RUN_SAFE, 'stop']);
  console.log(r.stdout.trim());
}

function flushRedis(redis) {
  const r = run('docker', ['exec', redis, 'redis-cli', '-n', String(REDIS_DB), 'FLUSHDB']);
  if (r.status !== 0) fail(`FLUSHDB of Redis database ${REDIS_DB} failed: ${r.stderr}`);
}

/** One k6 run. Returns the row of runs.csv, or throws with the round, the algo and the status codes when a request failed. */
function k6Run(round, algo) {
  const summaryPath = join(K6_DIR, `round${round}-${algo}.json`);
  rmSync(summaryPath, { force: true });
  const r = run(
    'k6',
    ['run', '--quiet', '--no-usage-report', '-e', `ALGO=${algo}`, '-e', `PAIRS=${PAIRS}`, '-e', `SESSIONS=${join(RAW_DIR, 'sessions.json')}`, '-e', `SUMMARY=${summaryPath}`, '-e', `BASE_URL=${BASE_URL}`, join(ROOT, 'scripts', 'e7', 'feed.k6.js')],
    { env: { ...process.env, K6_NO_USAGE_REPORT: 'true' }, maxBuffer: 64 * 1024 * 1024 },
  );
  // The status codes of the failed requests, from the lines the script logs.
  const codes = {};
  for (const m of `${r.stdout}\n${r.stderr}`.matchAll(/E7_FAIL status=(\d+)/g)) codes[m[1]] = (codes[m[1]] ?? 0) + 1;
  const codeText = Object.keys(codes).length === 0 ? 'none logged' : Object.entries(codes).map(([c, n]) => `${c} x ${n}`).join(', ');
  if (!existsSync(summaryPath)) {
    fail(`k6 wrote no summary for round ${round}, ${algo} (exit ${r.status}). Output:\n${r.stdout}\n${r.stderr}`);
  }
  const s = JSON.parse(readFileSync(summaryPath, 'utf8'));
  const badStatus = Object.values(codes).reduce((a, b) => a + b, 0);
  if (s.failed > 0 || badStatus > 0) {
    fail(`http_req_failed: ${Math.max(s.failed, badStatus)} of ${s.requests} requests failed in round ${round}, ${algo}. Status codes: ${codeText}. The k6 summaries are in ${K6_DIR}`);
  }
  if (s.requests !== ITERATIONS) fail(`round ${round}, ${algo}: k6 sent ${s.requests} requests, expected ${ITERATIONS} (k6 exit ${r.status})`);
  if (r.status !== 0) fail(`k6 exited with ${r.status} in round ${round}, ${algo}:\n${r.stderr}`);
  return {
    round,
    algo,
    warmup: round === 1,
    requests: s.requests,
    failed: s.failed,
    minMs: s.min_ms,
    medianMs: s.median_ms,
    p95Ms: s.p95_ms,
    maxMs: s.max_ms,
  };
}

function environment(containers, throttleLimit, loadAtStart) {
  const imageOf = (name) => out('docker', ['inspect', '-f', '{{.Config.Image}} id {{.Image}}', name], `docker inspect ${name}`);
  const cpu = cpus();
  return {
    os: `${osType()} ${release()} ${arch()}`,
    cpuModel: cpu[0]?.model ?? 'unknown',
    cores: cpu.length,
    memoryBytes: totalmem(),
    loadAverageAtStart: loadAtStart.map((x) => Number(x.toFixed(2))),
    node: process.version,
    k6: out('k6', ['version'], 'k6 version').split('\n')[0],
    docker: out('docker', ['version', '--format', '{{.Server.Version}}'], 'docker version', false),
    postgres: out('docker', ['exec', containers.db, 'postgres', '--version'], 'postgres --version', false),
    postgresImage: imageOf(containers.db),
    redisImage: imageOf(containers.redis),
    backend: 'node dist/main.js, built and started by .claude/hooks/run-safe.sh on localhost',
    schema: 'eval_load',
    redisDatabase: REDIS_DB,
    cacheEnabled: false,
    asOfEnabled: true,
    throttleLimit,
    loadProfile: LOAD_PROFILE,
  };
}

function runsCsv(rows) {
  const lines = [RUNS_HEADER.join(',')];
  for (const r of rows) {
    lines.push([r.round, r.algo, r.warmup, r.requests, r.failed, r.minMs.toFixed(6), r.medianMs.toFixed(6), r.p95Ms.toFixed(6), r.maxMs.toFixed(6)].join(','));
  }
  return `${lines.join('\n')}\n`;
}

function main() {
  const { values } = parseArgs({ options: { 'throttle-limit': { type: 'string', default: '1000000' }, rounds: { type: 'string', default: '5' } }, strict: true });
  if (!/^[1-9][0-9]*$/.test(values['throttle-limit'])) fail(`--throttle-limit needs a positive whole number, got "${values['throttle-limit']}"`);
  if (!/^[1-9][0-9]*$/.test(values.rounds)) fail(`--rounds needs a positive whole number, got "${values.rounds}"`);
  const throttleLimit = Number(values['throttle-limit']);
  const rounds = Number(values.rounds);

  const containers = checks();
  const loadAtStart = loadavg();

  // Old raw files must not reach the summary when this run stops early.
  mkdirSync(K6_DIR, { recursive: true });
  for (const f of ['runs.csv', 'environment.json']) rmSync(join(RAW_DIR, f), { force: true });

  // The packages the backend imports must be built (CLAUDE.md "Overview").
  for (const w of ['@breadit/shared', '@breadit/ranking']) {
    const b = run('npm', ['run', 'build', '-w', w], { stdio: 'inherit' });
    if (b.status !== 0) fail(`build of ${w} failed`);
  }

  // 1. Prepare: query counts and sessions. F1 (wrong dataset) and F8 (a count that moves) stop here, before the backend starts.
  console.log('== prepare: Prisma queries per request, sessions ==');
  const prep = run('npm', ['run', 'bench:prepare', '-w', '@breadit/backend'], {
    stdio: 'inherit',
    env: { ...baseEnv(), E7_OUT: RAW_DIR, E7_JWT_SECRET: JWT_SECRET },
  });
  if (prep.status !== 0) fail('the prepare step failed (see the Jest output above). No backend was started');

  // 2. The backend.
  console.log('== backend: eval_load, cache off, asOf on, Redis db 3 ==');
  backendStarted = true;
  const started = run('bash', [RUN_SAFE, 'start', '--no-cache'], {
    stdio: 'inherit',
    env: { ...baseEnv(), DATABASE_URL, REDIS_URL, JWT_SECRET, FEED_ASOF_ENABLED: 'true', THROTTLE_LIMIT: String(throttleLimit) },
  });
  if (started.status !== 0) fail('the backend did not start (see the output above)');

  // 3. The runs.
  const rows = [];
  console.log(`== k6: ${rounds} rounds x ${ALGOS.length} algos, ${ITERATIONS} requests each, throttle limit ${throttleLimit} ==`);
  for (let round = 1; round <= rounds; round++) {
    for (const algo of rotate(round)) {
      flushRedis(containers.redis);
      const row = k6Run(round, algo);
      rows.push(row);
      console.log(`round ${round}${row.warmup ? ' (warm-up)' : ''}  ${algo.padEnd(10)}  median ${row.medianMs.toFixed(2)} ms  p95 ${row.p95Ms.toFixed(2)} ms  failed ${row.failed}`);
    }
  }

  // 4. Stop the backend, write the raw files, summarize.
  stopBackend();
  writeFileSync(join(RAW_DIR, 'runs.csv'), runsCsv(rows), 'utf8');
  writeFileSync(join(RAW_DIR, 'environment.json'), `${JSON.stringify(environment(containers, throttleLimit, loadAtStart), null, 2)}\n`, 'utf8');
  console.log('== summary ==');
  const sum = run('npm', ['run', 'e7:summary', '-w', '@breadit/eval'], { stdio: 'inherit' });
  if (sum.status !== 0) fail('the summary step failed (see the output above)');
}

// The backend is stopped whatever happens: an error, Ctrl-C or a kill.
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopBackend();
    process.exit(130);
  });
}
try {
  main();
} catch (e) {
  console.error(`\nbench:e7: ${e.message}`);
  process.exitCode = 1;
} finally {
  stopBackend();
}
