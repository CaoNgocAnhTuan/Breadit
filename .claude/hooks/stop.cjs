#!/usr/bin/env node
'use strict';
/**
 * Stop hook: while the active task is being implemented, Claude cannot end a turn with
 * failing backend unit tests.
 *
 * It runs the tests only when backend files differ from the last green run (a hash of the diff
 * is kept in .claude/state/unit-pass). If they fail, the turn goes on once with the test output.
 * If they still fail after that (stop_hook_active), the turn may end, with a warning to the author.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const h = require('./lib.cjs');

const input = h.readInput();
if (h.HARNESS_OFF) h.done();
if (!h.canImplement(h.activeTask())) h.done();

const PATHS = ['apps/backend/src', 'apps/backend/test', 'apps/backend/prisma'];
if (!h.git(['status', '--porcelain', '--', ...PATHS])) h.done();

const fp = fingerprint();
if (fp === h.readState('unit-pass')) h.done();

const cmd = process.env.BREADIT_HARNESS_UNIT_CMD || 'npm run test -w @breadit/backend --silent';
const r = spawnSync('bash', ['-c', cmd], { cwd: h.projectDir(), encoding: 'utf8', timeout: 280000 });
if (r.status === 0) {
  h.writeState('unit-pass', fp);
  h.done({ systemMessage: '[harness] backend unit tests pass' });
}
if (input.stop_hook_active) {
  h.done({ systemMessage: '[harness] backend unit tests still fail. Look at them before the next step.' });
}
const tail = `${r.stdout || ''}\n${r.stderr || ''}${r.error ? `\n${r.error.message}` : ''}`.trim().split('\n').slice(-40).join('\n');
h.done({
  decision: 'block',
  reason:
    `[harness] Backend unit tests fail with the current changes (\`${cmd}\`). ` +
    'Fix them before you finish. If a red test is expected now (a test written before its fix), say so to the author.\n\n' +
    tail,
});

function fingerprint() {
  const hash = crypto.createHash('sha256');
  hash.update(h.git(['diff', 'HEAD', '--', ...PATHS]) || '');
  const untracked = (h.git(['ls-files', '--others', '--exclude-standard', '--', ...PATHS]) || '')
    .split('\n')
    .filter(Boolean)
    .sort();
  for (const f of untracked) {
    hash.update(f);
    try {
      hash.update(fs.readFileSync(path.join(h.projectDir(), f)));
    } catch {
      // deleted in between
    }
  }
  return hash.digest('hex');
}
