#!/usr/bin/env node
'use strict';
/**
 * SessionStart hook (startup, resume, /clear, compact): tells Claude where the work stands.
 * Branch, uncommitted files, whether db and redis run, the active task and its next step.
 */
const { spawnSync } = require('child_process');
const h = require('./lib.cjs');

h.readInput();
if (h.HARNESS_OFF) h.done({ systemMessage: '[harness] off (BREADIT_HARNESS=off)' });

const lines = [
  'Breadit harness (.claude/). Every feature, super-plan item or bug fix follows the author\'s workflow: ' +
    '/task or /bugfix writes spec.md → the author types /approve → /design (designer agent, Opus) → /approve → ' +
    '/plan → /approve → /implement. Code edits ask the author unless the active task has an approved plan.',
];

const branch = h.currentBranch();
lines.push(branch === 'test-app' ? 'Branch: test-app.' : `Branch: ${branch || 'unknown'}. All work belongs on test-app.`);

const dirty = (h.git(['status', '--porcelain']) || '').split('\n').filter(Boolean);
lines.push(
  dirty.length
    ? `Uncommitted files (${dirty.length}): ${dirty.slice(0, 8).map((l) => l.slice(3)).join(', ')}${dirty.length > 8 ? ', ...' : ''}.`
    : 'Working tree clean.',
);
lines.push(dockerLine());

const active = h.activeTask();
let summary = 'no active task';
if (active) {
  const d = h.describe(active);
  summary = `${active.folder}: ${d.stage}`;
  lines.push(`Active task: ${active.folder} (${h.statusLine(active)}). Stage: ${d.stage}.${d.next ? ` Next: ${d.next}.` : ''}`);
} else {
  lines.push('No active task.');
}
const open = h.listTasks().filter((t) => (!active || t.folder !== active.folder) && h.describe(t).stage !== 'done');
if (open.length) {
  lines.push(
    `Other open tasks: ${open.map((t) => `${t.folder} (${h.describe(t).stage})`).join('; ')}. ` +
      'Switch with `node .claude/hooks/task.cjs use <folder>`.',
  );
}

h.done({
  systemMessage: `[harness] ${branch || '?'} · ${summary}`,
  hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') },
});

function dockerLine() {
  const r = spawnSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8', timeout: 2500 });
  if (r.error || r.status !== 0) {
    return 'Docker: not reachable. Integration tests and /run-safe need `docker compose up db redis -d`.';
  }
  const names = r.stdout.split('\n');
  const db = names.some((n) => /(^|[-_])db([-_]\d+)?$/.test(n));
  const redis = names.some((n) => /(^|[-_])redis([-_]\d+)?$/.test(n));
  return `Docker: db ${db ? 'up' : 'down'}, redis ${redis ? 'up' : 'down'}${db && redis ? '' : ' (start them with `docker compose up db redis -d`)'}.`;
}
