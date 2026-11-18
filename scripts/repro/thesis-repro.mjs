#!/usr/bin/env node
// thesis:repro (task p8-repro, design "Approach", Part B). Run it with `npm run thesis:repro` from the repo root, with Node from
// .nvmrc (`nvm use`), `docker compose up db redis -d`, and the two Digg zips in datasets/raw/digg2009/. It takes about 3 hours.
//
//   1. checks (a few seconds, nothing is written): Node, the merged manifest, a clean .docs/results and eval/config, the Digg zips
//      with their SHA-256, Docker with db and redis ready. All problems are listed together, then the command stops;
//   2. build: @breadit/ranking, the Prisma client;
//   3. clean: delete every Class D folder named in .docs/results/manifest.json (.docs/results/<id>/ and eval/results/<id>/) and
//      eval/data/. p7-e7 (Class R, latency) stays: it is a report input and is never compared;
//   4. data: gen, adapt:digg, check;
//   5. runs: p5-baseline, the two P7 tuning runs, freeze --check, the ten approved test configs;
//   6. parity: the sample (alpha and beta from p7-main.json), load and load:check of syn-W2M-M, the backend parity test;
//   7. report, then the compare with .docs/results/manifest.json (its exit code is the exit code of this command).
//
// Each step writes its output to eval/results/repro/<nn>-<name>.log (git-ignored). The terminal shows one line per step. The run time
// is printed only and never saved (Class R). The first step that fails stops the command: it prints the last 30 log lines and exits 1.
// It never imports app code, it never writes a run config (freeze --check only) and it never tunes: the test configs are the approved ones.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { totalmem } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const RESULTS = join(ROOT, '.docs', 'results');
const RAW = join(ROOT, 'eval', 'results');
const LOG_DIR = join(RAW, 'repro');
const MERGED = join(RESULTS, 'manifest.json');
const DIGG_DIR = join(ROOT, 'datasets', 'raw', 'digg2009');
const PRISMA_SCHEMA = 'apps/backend/prisma/schema.prisma';
/** The Docker URL of the dev database, in the schema of the loader (never `public`). */
const DATABASE_URL = 'postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=eval_load';
const PARITY_DATASET = 'syn-W2M-M';
/** The ten approved P7 test configs. p7-h0 goes first: a failed H0 gate throws (design: Approach, Part B step 5). */
const TEST_RUNS = ['p7-h0', 'p7-main', 'p7-e5-worlds', 'p7-e4-terms', 'p7-e4-m0', 'p7-e4-m2', 'p7-e4-m10', 'p7-e6-ties', 'p7-e8-pool', 'p7-e5-shuffle'];
const MIN_MEMORY_BYTES = 8 * 1024 ** 3;

function fail(message) {
  throw new Error(message);
}

function run(cmd, args, opts = {}) {
  return spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', ...opts });
}

/** The same lookup as `containerName` of scripts/e7/run-e7.mjs (copied: that file runs its main() on import). Returns null when not running. */
function containerName(service) {
  const r = run('docker', ['ps', '--format', '{{.Names}}']);
  if (r.status !== 0) return null;
  const re = new RegExp(`(^|[-_])${service}([-_][0-9]+)?$`);
  return r.stdout.split('\n').find((n) => re.test(n)) ?? null;
}

/** The env of every child: the shell env without what could change the feed or the parity test (like `baseEnv` of run-e7.mjs), plus DATABASE_URL. */
function childEnv() {
  const env = { ...process.env };
  for (const k of ['FEED_DEFAULT_ALGO', 'REDIS_HTTP_CACHE_ENABLED', 'NODE_ENV', 'PARITY_DATABASE_URL', 'PARITY_REDIS_URL']) delete env[k];
  env.DATABASE_URL = DATABASE_URL;
  return env;
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

/** alpha and beta of H on syn-W2M-M in the approved config of the main test: the one source the app, its unit test and this command share. */
export function parityParams() {
  const config = JSON.parse(readFileSync(join(ROOT, 'eval', 'config', 'runs', 'p7-main.json'), 'utf8'));
  const h = config.datasetParams?.[PARITY_DATASET]?.H;
  if (h === undefined || !Number.isFinite(h.alpha) || !Number.isFinite(h.beta)) {
    fail(`eval/config/runs/p7-main.json has no datasetParams["${PARITY_DATASET}"].H with alpha and beta`);
  }
  return { alpha: h.alpha, beta: h.beta };
}

/** The ids of the Class D folders in the merged manifest. Each id is checked, so a bad manifest can never make the clean step delete another path. */
export function classDFolders() {
  const merged = JSON.parse(readFileSync(MERGED, 'utf8'));
  const ids = Object.keys(merged.results ?? {})
    .filter((id) => merged.results[id].class === 'D')
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const id of ids) if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) fail(`.docs/results/manifest.json lists a folder with a bad name: "${id}"`);
  return ids;
}

/** Step 1. Writes nothing. Returns every problem (the command stops when there is one) and the warnings. */
export function checks() {
  const problems = [];
  const warnings = [];

  // F1
  const pinned = readFileSync(join(ROOT, '.nvmrc'), 'utf8').trim();
  if (process.version !== pinned) problems.push(`Node ${process.version} is not the version in .nvmrc (${pinned}). Run "nvm use" in the repo root first.`);

  // F4 (and the merged manifest the compare needs)
  if (!existsSync(MERGED)) {
    problems.push('.docs/results/manifest.json does not exist (the merged manifest). Restore it from git, or make it with: npm run results:manifest -w @breadit/eval -- --write');
  }
  const git = run('git', ['status', '--porcelain', '--', '.docs/results', 'eval/config']);
  if (git.status !== 0) {
    problems.push(`git status failed: ${(git.stderr ?? '').trim() || (git.error ? git.error.message : 'unknown error')}`);
  } else if (git.stdout.trim() !== '') {
    problems.push(
      `uncommitted changes in .docs/results or eval/config. The clean step deletes the results folders, so it never runs over uncommitted work. Commit or restore them first:\n${git.stdout
        .trimEnd()
        .split('\n')
        .map((l) => `    ${l}`)
        .join('\n')}`,
    );
  }

  // F2
  const digg = JSON.parse(readFileSync(join(ROOT, 'eval', 'config', 'digg2009.json'), 'utf8'));
  for (const zip of Object.values(digg.zips)) {
    const path = join(DIGG_DIR, zip.file);
    const shown = `datasets/raw/digg2009/${zip.file}`;
    if (!existsSync(path)) {
      problems.push(`${shown} is missing. Download it (see .docs/datasets.md section 4). Its SHA-256 must be ${zip.sha256}`);
    } else {
      const got = sha256File(path);
      if (got !== zip.sha256) problems.push(`${shown} has SHA-256 ${got}, expected ${zip.sha256} (see .docs/datasets.md section 4)`);
    }
  }

  // F3
  const up = run('docker', ['ps']);
  if (up.status !== 0) {
    problems.push('Docker does not answer. Start Docker, then: docker compose up db redis -d');
  } else {
    const db = containerName('db');
    const redis = containerName('redis');
    if (db === null) problems.push('the db container is not running. Start it: docker compose up db redis -d');
    else if (run('docker', ['exec', db, 'pg_isready', '-U', 'breadit', '-d', 'breadit']).status !== 0) problems.push(`the db container (${db}) is not ready (pg_isready failed). Wait a few seconds, or check: docker compose logs db`);
    if (redis === null) problems.push('the redis container is not running. Start it: docker compose up db redis -d');
    else if (run('docker', ['exec', redis, 'redis-cli', 'ping']).stdout.trim() !== 'PONG') problems.push(`the redis container (${redis}) does not answer PONG. Check: docker compose logs redis`);
  }

  // F5: only a warning
  if (totalmem() < MIN_MEMORY_BYTES) {
    warnings.push(`this machine has ${(totalmem() / 1024 ** 3).toFixed(1)} GB of memory; p7-tune-main peaks near 3 GB (with --max-old-space-size=4096), so the run may stop out of memory`);
  }
  return { problems, warnings };
}

/** Deletes the Class D folders and eval/data (step 3). p7-e7, the merged manifest and the logs of this run stay. Returns what it deleted. */
export function clean() {
  const deleted = [];
  const paths = [];
  for (const id of classDFolders()) paths.push(join(RESULTS, id), join(RAW, id));
  paths.push(join(ROOT, 'eval', 'data'));
  for (const p of paths) {
    if (!existsSync(p)) continue;
    rmSync(p, { recursive: true, force: true });
    deleted.push(p.slice(ROOT.length + 1));
  }
  return deleted;
}

/**
 * The steps in order. A step has a `name` and either `cmd` (a command and its arguments, run in the repo root) or `fn` (a function
 * that returns the lines for its log). `params` are alpha and beta of the parity sample.
 */
export function steps(params) {
  const npm = (name, args) => ({ name, cmd: ['npm', 'run', ...args] });
  /** The arguments of `npm run <script> -w @breadit/eval [-- <rest>]`. */
  const ev = (script, ...rest) => [script, '-w', '@breadit/eval', ...(rest.length > 0 ? ['--', ...rest] : [])];
  return [
    npm('build-ranking', ['build', '-w', '@breadit/ranking']),
    { name: 'prisma-generate', cmd: ['npx', 'prisma', 'generate', `--schema=${PRISMA_SCHEMA}`] },
    { name: 'clean', fn: () => clean().map((p) => `deleted ${p}`) },
    npm('gen', ev('gen')),
    npm('adapt-digg', ev('adapt:digg')),
    npm('check', ev('check')),
    npm('harness-p5-baseline', ev('harness', 'p5-baseline')),
    npm('harness-p7-tune-worlds', ev('harness', 'p7-tune-worlds')),
    npm('harness-p7-tune-main', ev('harness', 'p7-tune-main')),
    npm('freeze-check', ev('freeze', '--check')),
    ...TEST_RUNS.map((id) => npm(`harness-${id}`, ev('harness', id))),
    npm('parity', ev('parity', '--param', `alpha=${params.alpha}`, '--param', `beta=${params.beta}`)),
    npm('load', ev('load', PARITY_DATASET)),
    npm('load-check', ev('load:check', PARITY_DATASET)),
    npm('test-parity', ['test:parity', '-w', '@breadit/backend']),
    npm('report', ev('report')),
    npm('compare', ev('results:manifest')),
  ];
}

function seconds(t0) {
  return ((Date.now() - t0) / 1000).toFixed(1); // harness-allow: run time printed only (Class R)
}

function tail(path, n) {
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').split('\n');
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines.slice(-n);
}

/** Runs one step with its output in `logPath`. Returns { ok, code, secs }. */
export function runStep(step, logPath) {
  const t0 = Date.now(); // harness-allow: run time printed only (Class R)
  if (step.fn !== undefined) {
    try {
      const lines = step.fn();
      writeFileSync(logPath, lines.length > 0 ? `${lines.join('\n')}\n` : 'nothing to delete\n', 'utf8');
      return { ok: true, code: 0, secs: seconds(t0) };
    } catch (e) {
      writeFileSync(logPath, `error: ${e.message}\n`, 'utf8');
      return { ok: false, code: 1, secs: seconds(t0) };
    }
  }
  const fd = openSync(logPath, 'w');
  let r;
  try {
    r = spawnSync(step.cmd[0], step.cmd.slice(1), { cwd: ROOT, env: childEnv(), stdio: ['ignore', fd, fd] });
  } finally {
    closeSync(fd);
  }
  if (r.error) appendFileSync(logPath, `error: ${r.error.message}\n`, 'utf8');
  const code = r.status ?? 1;
  return { ok: code === 0, code, secs: seconds(t0) };
}

function main() {
  const t0 = Date.now(); // harness-allow: run time printed only (Class R)

  const { problems, warnings } = checks();
  for (const w of warnings) console.log(`warning: ${w}`);
  if (problems.length > 0) {
    console.log(`FAIL  checks: ${problems.length} problem${problems.length === 1 ? '' : 's'}. Nothing was written or deleted.`);
    for (const p of problems) console.log(`  - ${p}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ok    checks (Node ${process.version}, merged manifest, clean tree, Digg zips, db and redis)  ${seconds(t0)} s`);
  console.log('note  p7-e7 (Class R, latency) is kept as a report input and is not compared');

  const params = parityParams();
  const all = steps(params);
  rmSync(LOG_DIR, { recursive: true, force: true });
  mkdirSync(LOG_DIR, { recursive: true });
  const pad = String(all.length).length;
  let lastLog = '';
  for (let i = 0; i < all.length; i++) {
    const step = all[i];
    const n = String(i + 1).padStart(pad, '0');
    lastLog = join(LOG_DIR, `${n}-${step.name}.log`);
    const r = runStep(step, lastLog);
    if (!r.ok) {
      console.log(`FAIL  ${n} ${step.name}  exit ${r.code}  ${r.secs} s`);
      console.log(`--- last 30 lines of ${lastLog.slice(ROOT.length + 1)} ---`);
      for (const l of tail(lastLog, 30)) console.log(l);
      console.log('---');
      console.log('The tree is left as it is. The committed files come back from git; `git status .docs/results eval/config` shows what changed.');
      process.exitCode = 1;
      return;
    }
    console.log(`ok    ${n} ${step.name.padEnd(26)} ${r.secs} s`);
  }

  // The last line of the compare step is its summary: "equal: <n> files in <r> folders and <d> datasets".
  const summary = tail(lastLog, 1)[0] ?? '';
  if (!summary.startsWith('equal:')) {
    console.log(`FAIL  the compare step did not end with an "equal:" line (see ${lastLog.slice(ROOT.length + 1)})`);
    process.exitCode = 1;
    return;
  }
  console.log(`every hash is equal: ${summary.slice('equal: '.length)} (total ${seconds(t0)} s)`);
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (e) {
    console.error(`\nthesis:repro: ${e.message}`);
    process.exitCode = 1;
  }
}
