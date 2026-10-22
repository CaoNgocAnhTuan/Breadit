#!/usr/bin/env node
'use strict';
/**
 * Tests for the harness hooks and the task CLI.
 * Builds a throwaway git repo in the OS temp folder (so the real repo is never touched), feeds
 * sample hook inputs to each hook, and checks the decision.
 *
 *   node .claude/hooks/test-hooks.cjs          (KEEP=1 keeps the temp repo for debugging)
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync, execFileSync } = require('child_process');

const HOOKS = __dirname;
const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'breadit-harness-')));
const env = { ...process.env, CLAUDE_PROJECT_DIR: root, BREADIT_HARNESS: '' };
delete env.BREADIT_HARNESS_UNIT_CMD;

let passed = 0;
let failed = 0;

// ---------------------------------------------------------------- helpers

const sh = (...args) => execFileSync(args[0], args.slice(1), { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
function put(rel, text) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text);
}
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

function run(hook, payload, extraEnv = {}) {
  const r = spawnSync('node', [path.join(HOOKS, hook)], {
    cwd: root,
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...env, ...extraEnv },
  });
  const raw = (r.stdout || '').trim();
  let out = null;
  if (raw) {
    try {
      out = JSON.parse(raw);
    } catch {
      out = { raw };
    }
  }
  return { code: r.status, out, stderr: r.stderr };
}

function outcome(res) {
  const o = res.out;
  if (res.code !== 0) return `exit ${res.code}`;
  if (!o) return 'pass';
  const hso = o.hookSpecificOutput || {};
  if (hso.permissionDecision) return hso.permissionDecision;
  if (o.decision === 'block') return 'block';
  if (hso.additionalContext) return 'context';
  if (o.systemMessage) return 'message';
  return 'pass';
}

function expect(name, res, want, check) {
  const got = outcome(res);
  const ok = got === want && (!check || check(res));
  if (ok) passed += 1;
  else failed += 1;
  const detail = ok ? '' : `   want ${want}, got ${got}: ${JSON.stringify(res.out || res.stderr || '').slice(0, 400)}`;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail}`);
}

function check(name, ok, detail = '') {
  if (ok) passed += 1;
  else failed += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `   ${detail}`}`);
}

const abs = (rel) => (path.isAbsolute(rel) ? rel : path.join(root, rel));
const edit = (rel, oldString, newString) => ({ tool_name: 'Edit', cwd: root, tool_input: { file_path: abs(rel), old_string: oldString, new_string: newString } });
const write = (rel, content) => ({ tool_name: 'Write', cwd: root, tool_input: { file_path: abs(rel), content } });
const bash = (command) => ({ tool_name: 'Bash', cwd: root, tool_input: { command } });
const prompt = (text) => ({ hook_event_name: 'UserPromptSubmit', cwd: root, prompt: text });
const cli = (...args) => spawnSync('node', [path.join(HOOKS, 'task.cjs'), ...args], { cwd: root, encoding: 'utf8', env });
const reason = (res) => String(((res.out || {}).hookSpecificOutput || {}).permissionDecisionReason || (res.out || {}).reason || '');

function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------- a fake project

sh('git', 'init', '-q', '-b', 'test-app');
sh('git', 'config', 'user.email', 'harness@test.local');
sh('git', 'config', 'user.name', 'harness test');
sh('git', 'config', 'commit.gpgsign', 'false');
put('docs/README.md', 'pre-thesis doc\n');
put('Latex/main.tex', '\\documentclass{report}\n');
put('apps/backend/src/posts/x.ts', 'export const x = 1;\n');
put('apps/backend/prisma/migrations/20260101000000_init/migration.sql', '-- init\n');
put('datasets/humans_v1.sql', '-- data\n');
put('.env.example', 'JWT_SECRET=\n');
put('CLAUDE.md', '# CLAUDE.md\n');
sh('git', 'add', '-A');
sh('git', 'commit', '-q', '-m', 'init');

// ---------------------------------------------------------------- task CLI: new task

const folder = `${today()}-demo-bug`;
const T = `.docs/works/${folder}`;
let r = cli('new', 'demo-bug', '--type', 'bug', '--id', 'B99', '--title', 'Demo bug');
check('cli new creates the task folder and spec.md', r.status === 0 && fs.existsSync(abs(`${T}/spec.md`)), r.stderr);
check('cli new fills the bug template', /Bug ID: B99/.test(read(`${T}/spec.md`)) && /^Status: draft/m.test(read(`${T}/spec.md`)));
check('cli new sets the active task', read('.claude/state/active-task').trim() === folder);
r = cli('check', 'design');
check('cli check design is BLOCKED while the spec is a draft', r.status === 1 && /BLOCKED/.test(r.stdout), r.stdout);

// ---------------------------------------------------------------- pre-edit: file guard

expect('Write Latex/main.tex is denied', run('pre-edit.cjs', write('Latex/main.tex', 'x')), 'deny');
expect('Edit docs/README.md is denied', run('pre-edit.cjs', edit('docs/README.md', 'pre', 'post')), 'deny');
expect('Write .env is denied', run('pre-edit.cjs', write('.env', 'A=1')), 'deny');
expect('Write apps/backend/.env.local is denied', run('pre-edit.cjs', write('apps/backend/.env.local', 'A=1')), 'deny');
expect('Edit a committed migration is denied', run('pre-edit.cjs', edit('apps/backend/prisma/migrations/20260101000000_init/migration.sql', 'init', 'x')), 'deny');
expect('Write datasets/humans_v1.sql is denied', run('pre-edit.cjs', write('datasets/humans_v1.sql', 'x')), 'deny');
expect('Write .docs/results/manifest.json is denied', run('pre-edit.cjs', write('.docs/results/manifest.json', '{}')), 'deny');
expect('Write a new (untracked) migration asks', run('pre-edit.cjs', write('apps/backend/prisma/migrations/20260202000000_x/migration.sql', '--')), 'ask');
expect('Write .env.example asks (config, no plan)', run('pre-edit.cjs', write('.env.example', 'A=')), 'ask');

// ---------------------------------------------------------------- pre-edit: approval gate

expect('Edit backend code with a draft spec asks', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'ask', (x) => /no plan is approved/.test(reason(x)));
expect('Write .docs/notes.md passes', run('pre-edit.cjs', write('.docs/notes.md', 'notes')), 'pass');
expect('Edit CLAUDE.md passes', run('pre-edit.cjs', edit('CLAUDE.md', '# CLAUDE.md', '# CLAUDE.md!')), 'pass');
expect('Write a file outside the project passes', run('pre-edit.cjs', write(path.join(os.tmpdir(), 'outside-harness.txt'), 'x')), 'pass');
expect('Write .claude/state/x passes', run('pre-edit.cjs', write('.claude/state/x', 'x')), 'pass');
expect('Write .claude/settings.json asks', run('pre-edit.cjs', write('.claude/settings.json', '{}')), 'ask');

// ---------------------------------------------------------------- pre-edit: task files

expect('Write design.md before the spec is approved is denied', run('pre-edit.cjs', write(`${T}/design.md`, 'Status: draft\n')), 'deny');
expect('Edit spec.md to "Status: approved" is denied', run('pre-edit.cjs', edit(`${T}/spec.md`, `Status: draft · ${today()}`, `Status: approved · ${today()}`)), 'deny');
expect('Write spec.md with "Status: approved" is denied', run('pre-edit.cjs', write(`${T}/spec.md`, '# x\n\nStatus: approved · 2026-01-01\n')), 'deny');
expect('Edit a draft spec.md passes', run('pre-edit.cjs', edit(`${T}/spec.md`, '## 1. Problem', '## 1. Problem\n\nIt breaks.')), 'pass');

// ---------------------------------------------------------------- on-prompt: /approve

expect('a normal prompt is ignored', run('on-prompt.cjs', prompt('please look at the feed')), 'pass');
r = run('on-prompt.cjs', prompt('/approve'));
expect('/approve approves spec.md', r, 'context', () => /^Status: approved/m.test(read(`${T}/spec.md`)));
check('/approve tells the author the next command', /Next: \/design/.test((r.out || {}).systemMessage || ''), JSON.stringify(r.out));
expect('Edit an approved spec.md is denied (reopen first)', run('pre-edit.cjs', edit(`${T}/spec.md`, '## 1. Problem', '## 1. Problem!')), 'deny', (x) => /reopen spec/.test(reason(x)));

r = cli('scaffold', 'design');
check('cli scaffold design works once the spec is approved', r.status === 0 && fs.existsSync(abs(`${T}/design.md`)), r.stderr);
expect('Edit design.md passes once the spec is approved', run('pre-edit.cjs', edit(`${T}/design.md`, '## 1. Approach', '## 1. Approach\n\nUse a unique key.')), 'pass');
expect('Write plan.md before the design is approved is denied', run('pre-edit.cjs', write(`${T}/plan.md`, 'Status: draft\n')), 'deny');
r = run('on-prompt.cjs', prompt('/approve plan'));
check('/approve plan refuses while the design is a draft', /must be approved before/.test((r.out || {}).systemMessage || '') && !fs.existsSync(abs(`${T}/plan.md`)), JSON.stringify(r.out));
run('on-prompt.cjs', prompt('/approve'));
check('/approve then approves design.md', /^Status: approved/m.test(read(`${T}/design.md`)));

r = cli('scaffold', 'plan');
check('cli scaffold plan works once the design is approved', r.status === 0 && fs.existsSync(abs(`${T}/plan.md`)), r.stderr);
expect('Edit backend code with a draft plan still asks', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'ask');
run('on-prompt.cjs', prompt('/approve'));
check('/approve then approves plan.md', /^Status: approved/m.test(read(`${T}/plan.md`)));
r = run('on-prompt.cjs', prompt('/approve'));
check('/approve with nothing left to approve changes nothing', /nothing to approve/.test((r.out || {}).systemMessage || ''), JSON.stringify(r.out));

// ---------------------------------------------------------------- pre-edit: approved plan

expect('Edit backend code with an approved plan passes', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'pass');
const plan = read(`${T}/plan.md`);
const box = (/^- \[ \] Test first.*$/m.exec(plan) || [''])[0];
expect('Tick a box in the approved plan passes', run('pre-edit.cjs', edit(`${T}/plan.md`, box, box.replace('[ ]', '[x]'))), 'pass');
expect('Change a step in the approved plan is denied', run('pre-edit.cjs', edit(`${T}/plan.md`, box, `${box} and more`)), 'deny', (x) => /reopen plan/.test(reason(x)));
const resultLine = plan.slice(plan.search(/^## Result/m)).split('\n')[2];
expect('Write in the Result section of the approved plan passes', run('pre-edit.cjs', edit(`${T}/plan.md`, resultLine, 'Done: 3 tests added.')), 'pass');
expect('Write the whole approved plan is denied', run('pre-edit.cjs', write(`${T}/plan.md`, plan)), 'deny');

// ---------------------------------------------------------------- pre-bash

expect('prisma db push is denied', run('pre-bash.cjs', bash('npx prisma db push --schema=apps/backend/prisma/schema.prisma')), 'deny');
expect('npm run dev:reset is denied', run('pre-bash.cjs', bash('npm run dev:reset')), 'deny');
expect('prisma migrate reset is denied', run('pre-bash.cjs', bash('npx prisma migrate reset --force')), 'deny');
expect('docker compose down -v is denied', run('pre-bash.cjs', bash('docker compose down -v')), 'deny');
expect('docker compose down passes', run('pre-bash.cjs', bash('docker compose down')), 'pass');
expect('cat .env is denied', run('pre-bash.cjs', bash('cat .env')), 'deny');
expect('grep in apps/backend/.env is denied', run('pre-bash.cjs', bash('grep SMTP apps/backend/.env')), 'deny');
expect('cat .env.example passes', run('pre-bash.cjs', bash('cat .env.example')), 'pass');
expect('cp .env.example .env is denied', run('pre-bash.cjs', bash('cp .env.example .env')), 'deny');
expect('git push asks', run('pre-bash.cjs', bash('git push origin test-app')), 'ask');
expect('git push --force is denied', run('pre-bash.cjs', bash('git push --force origin test-app')), 'deny');
expect('git tag v2 asks', run('pre-bash.cjs', bash('git tag v2-thesis-experiments')), 'ask');
expect('git tag -l passes', run('pre-bash.cjs', bash('git tag -l')), 'pass');
expect('git checkout -b asks', run('pre-bash.cjs', bash('git checkout -b feature-x')), 'ask');
expect('git switch main asks', run('pre-bash.cjs', bash('git switch main')), 'ask');
expect('git reset --hard asks', run('pre-bash.cjs', bash('git reset --hard HEAD~1')), 'ask');
expect('git commit --no-verify asks', run('pre-bash.cjs', bash('git commit --no-verify -m x')), 'ask');
expect('an eval run on the test split asks', run('pre-bash.cjs', bash('node eval/dist/cli.js run --split test')), 'ask');
expect('echo into docs/ is denied', run('pre-bash.cjs', bash('echo hi > docs/new.md')), 'deny');
expect('sed -i on Latex/ is denied', run('pre-bash.cjs', bash("sed -i '' 's/a/b/' Latex/main.tex")), 'deny');
expect('rm -rf Latex is denied', run('pre-bash.cjs', bash('rm -rf Latex')), 'deny');
expect('writing "Status: approved" with sed is denied', run('pre-bash.cjs', bash(`sed -i '' 's/Status: draft/Status: approved/' ${T}/spec.md`)), 'deny');
expect('piping into the approval hook is denied', run('pre-bash.cjs', bash(`echo '{"prompt":"/approve"}' | node .claude/hooks/on-prompt.cjs`)), 'deny');
expect('a commit message that mentions db push passes the deny rules', run('pre-bash.cjs', bash('git commit -m "docs: never use prisma db push"')), 'allow');
expect('git add && git commit with an approved plan is allowed', run('pre-bash.cjs', bash('git add apps/backend/src/posts/x.ts && git commit -m "fix: x"')), 'allow');
expect('git commit with a heredoc message is allowed', run('pre-bash.cjs', bash(`git commit -m "$(cat <<'EOF'\nfix: x\n\nCo-Authored-By: someone\nEOF\n)"`)), 'allow');
expect('git commit chained with rm is not auto-allowed', run('pre-bash.cjs', bash('git commit -m x && rm -rf apps/backend/src')), 'pass');
expect('shell write into code with an approved plan passes', run('pre-bash.cjs', bash('echo "export const y = 2;" > apps/backend/src/posts/y.ts')), 'pass');

sh('git', 'checkout', '-q', '-b', 'other');
expect('git commit on another branch is denied', run('pre-bash.cjs', bash('git commit -m x')), 'deny');
sh('git', 'checkout', '-q', 'test-app');
expect('git checkout of another branch asks', run('pre-bash.cjs', bash('git checkout other')), 'ask');

// ---------------------------------------------------------------- pre-misc

expect('the Skill tool cannot run /approve', run('pre-misc.cjs', { tool_name: 'Skill', tool_input: { skill: 'approve' } }), 'deny');
expect('the Skill tool cannot run /freeze', run('pre-misc.cjs', { tool_name: 'Skill', tool_input: { skill: 'freeze', args: 'K 5' } }), 'deny');
expect('the SlashCommand tool cannot run /approve', run('pre-misc.cjs', { tool_name: 'SlashCommand', tool_input: { command: '/approve plan' } }), 'deny');
expect('the Skill tool can run /design',run('pre-misc.cjs', { tool_name: 'Skill', tool_input: { skill: 'design' } }), 'pass');
expect('a scheduled /approve prompt is denied', run('pre-misc.cjs', { tool_name: 'ScheduleWakeup', tool_input: { prompt: '/approve', delaySeconds: 60 } }), 'deny');

// ---------------------------------------------------------------- post-edit

put('eval/src/score.ts', 'export const t = Date.now();\nexport const r = Math.random();\nconst ok = [3, 1].sort((a, b) => a - b);\n');
r = run('post-edit.cjs', write('eval/src/score.ts', ''));
expect('Date.now and Math.random in eval/ are reported', r, 'block', (x) => /line 1/.test(reason(x)) && /line 2/.test(reason(x)) && !/line 3/.test(reason(x)));
put('eval/src/timing.ts', 'export const t = Date.now(); // harness-allow: progress log only\n');
expect('a harness-allow line is not reported', run('post-edit.cjs', write('eval/src/timing.ts', '')), 'pass');
put('eval/src/score.spec.ts', 'const t = Date.now();\n');
expect('test files are not checked', run('post-edit.cjs', write('eval/src/score.spec.ts', '')), 'pass');
put('apps/backend/src/ranking/core/sort.ts', 'export const s = (a: string[]) => a.sort();\n');
expect('.sort() with no compare function in ranking/ is reported', run('post-edit.cjs', write('apps/backend/src/ranking/core/sort.ts', '')), 'block');
expect('code outside the determinism scope is not checked', run('post-edit.cjs', write('apps/backend/src/posts/x.ts', '')), 'pass');
put('.docs/works/2026-01-01-loose/spec.md', '# Spec: loose\n\nStatus: draft · 2026-01-01\nType: feature\n\n## 1. Problem\n\nx\n');
expect('a spec with missing sections gets a note', run('post-edit.cjs', write('.docs/works/2026-01-01-loose/spec.md', '')), 'context', (x) => /Done when/.test(x.out.hookSpecificOutput.additionalContext));

// ---------------------------------------------------------------- stop

r = run('stop.cjs', {}, { BREADIT_HARNESS_UNIT_CMD: 'echo "Tests: 1 failed"; exit 1' });
expect('stop blocks when the unit tests fail during implement', r, 'block', (x) => /Tests: 1 failed/.test(reason(x)));
expect('stop lets the turn end the second time', run('stop.cjs', { stop_hook_active: true }, { BREADIT_HARNESS_UNIT_CMD: 'exit 1' }), 'message');
expect('stop passes when the tests pass', run('stop.cjs', {}, { BREADIT_HARNESS_UNIT_CMD: 'exit 0' }), 'message');
expect('stop skips the tests when nothing changed since the last green run', run('stop.cjs', {}, { BREADIT_HARNESS_UNIT_CMD: 'exit 1' }), 'pass');

// ---------------------------------------------------------------- session start

r = run('session-start.cjs', { source: 'startup' });
expect('session start reports the branch and the active task', r, 'context', (x) => {
  const c = x.out.hookSpecificOutput.additionalContext;
  return /Branch: test-app/.test(c) && new RegExp(`Active task: ${folder}`).test(c) && /Stage: implementing/.test(c);
});

// ---------------------------------------------------------------- task CLI: reopen and done

r = cli('done');
check('cli done refuses while steps are unticked', r.status === 1 && /not ticked/.test(r.stderr), r.stderr);
r = cli('reopen', 'design');
check('cli reopen design puts design and plan back to draft', r.status === 0 && /^Status: draft/m.test(read(`${T}/design.md`)) && /^Status: draft/m.test(read(`${T}/plan.md`)) && /^Status: approved/m.test(read(`${T}/spec.md`)), r.stdout + r.stderr);
expect('after reopen, backend code edits ask again', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'ask');
run('on-prompt.cjs', prompt('/approve'));
run('on-prompt.cjs', prompt('/approve'));
put(`${T}/plan.md`, read(`${T}/plan.md`).replace(/- \[ \]/g, '- [x]'));
r = cli('done');
check('cli done closes the task when every box is ticked', r.status === 0 && /^Status: done/m.test(read(`${T}/plan.md`)) && !fs.existsSync(abs('.claude/state/active-task')), r.stdout + r.stderr);
expect('after done, code edits ask again', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'ask');

// ---------------------------------------------------------------- light mode and the off switch

r = cli('new', 'b9-explore-link', '--type', 'bug', '--light', '--id', 'B9');
check('cli new --light uses the light template', r.status === 0 && /Mode: light/.test(read(`.docs/works/${today()}-b9-explore-link/spec.md`)), r.stderr);
expect('a light task has no design.md', run('pre-edit.cjs', write(`.docs/works/${today()}-b9-explore-link/design.md`, 'x')), 'deny');
run('on-prompt.cjs', prompt('/approve'));
expect('an approved light spec allows code edits', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'pass');
expect('BREADIT_HARNESS=off turns the hooks off', run('pre-edit.cjs', write('Latex/main.tex', 'x'), { BREADIT_HARNESS: 'off' }), 'pass');

// ---------------------------------------------------------------- summary

console.log(`\n${passed} passed, ${failed} failed`);
if (process.env.KEEP) console.log(`temp repo kept: ${root}`);
else fs.rmSync(root, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
