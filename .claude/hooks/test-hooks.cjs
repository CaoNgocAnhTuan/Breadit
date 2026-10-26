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
const message = (res) => String((res.out || {}).systemMessage || '');

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
// an old task folder from before the two-file workflow
put('.docs/works/2026-01-01-old-task/spec.md', '# Spec: old\n\nStatus: done · 2026-01-01\n');
put('.docs/works/2026-01-01-old-task/design.md', '# Design: old\n\nStatus: approved · 2026-01-01\n');
sh('git', 'add', '-A');
sh('git', 'commit', '-q', '-m', 'init');

// ---------------------------------------------------------------- task CLI: new task

const folder = `${today()}-demo-bug`;
const T = `.docs/works/${folder}`;
let r = cli('new', 'demo-bug', '--type', 'bug', '--id', 'B99', '--title', 'Demo bug');
check('cli new creates the task folder with design.md only', r.status === 0 && fs.existsSync(abs(`${T}/design.md`)) && !fs.existsSync(abs(`${T}/spec.md`)), r.stderr);
const design0 = read(`${T}/design.md`);
check('cli new fills the bug template', /Bug ID: B99/.test(design0) && /^Spec status: draft/m.test(design0) && /^Design status: pending/m.test(design0));
check('cli new sets the active task', read('.claude/state/active-task').trim() === folder);
r = cli('new', 'x', '--type', 'experiment');
check('cli new refuses an unknown type', r.status === 1 && /unknown type/.test(r.stderr), r.stderr);
r = cli('status', '--all');
check('cli status lists the new task and ignores the old folder', /demo-bug/.test(r.stdout) && !/old-task/.test(r.stdout), r.stdout);

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

expect('Edit design.md to "Spec status: approved" is denied', run('pre-edit.cjs', edit(`${T}/design.md`, `Spec status: draft · ${today()}`, `Spec status: approved · ${today()}`)), 'deny');
expect('Write design.md with "Design status: approved" is denied', run('pre-edit.cjs', write(`${T}/design.md`, '# x\n\nDesign status: approved · 2026-01-01\n')), 'deny');
expect('Edit design.md to "Design status: draft" before the spec is approved is denied', run('pre-edit.cjs', edit(`${T}/design.md`, 'Design status: pending', `Design status: draft · ${today()}`)), 'deny', (x) => /approved spec/.test(reason(x)));
expect('Edit the Spec text of a draft design.md passes', run('pre-edit.cjs', edit(`${T}/design.md`, '### Problem', '### Problem\n\nIt breaks.')), 'pass');
expect('Write plan.md before the design is approved is denied', run('pre-edit.cjs', write(`${T}/plan.md`, 'Status: draft\n')), 'deny', (x) => /approved design/.test(reason(x)));

// ---------------------------------------------------------------- on-prompt: /approve (three times)

expect('a normal prompt is ignored', run('on-prompt.cjs', prompt('please look at the feed')), 'pass');
r = run('on-prompt.cjs', prompt('/approve'));
expect('the first /approve approves Spec and Impact', r, 'context', (x) => /APPROVED: spec/.test(x.out.hookSpecificOutput.additionalContext));
check('the first /approve sets Spec status and leaves Design pending', /^Spec status: approved/m.test(read(`${T}/design.md`)) && /^Design status: pending/m.test(read(`${T}/design.md`)));
check('the first /approve says Claude writes the Design section next', /Design section/.test(message(r)), message(r));
r = run('on-prompt.cjs', prompt('/approve'));
check('/approve while the Design section is not written changes nothing', /did nothing/.test(message(r)) && /^Design status: pending/m.test(read(`${T}/design.md`)), message(r));
expect('Edit design.md to "Design status: draft" passes once the spec is approved', run('pre-edit.cjs', edit(`${T}/design.md`, 'Design status: pending', `Design status: draft · ${today()}`)), 'pass');
put(`${T}/design.md`, read(`${T}/design.md`).replace('Design status: pending', `Design status: draft · ${today()}`));

expect('Write plan.md while the design is a draft is denied', run('pre-edit.cjs', write(`${T}/plan.md`, 'Status: draft\n')), 'deny');
r = run('on-prompt.cjs', prompt('/approve plan'));
check('/approve plan refuses while the design is next', /next step to approve is design/.test(message(r)) && !/^Design status: approved/m.test(read(`${T}/design.md`)), message(r));
r = run('on-prompt.cjs', prompt('/approve'));
expect('the second /approve approves the Design section', r, 'context', (x) => /APPROVED: design/.test(x.out.hookSpecificOutput.additionalContext));
check('the second /approve sets Design status', /^Design status: approved/m.test(read(`${T}/design.md`)));
r = run('on-prompt.cjs', prompt('/approve'));
check('/approve while plan.md is not written changes nothing', /did nothing/.test(message(r)), message(r));

const planTemplate = fs.readFileSync(path.join(HOOKS, '..', 'templates', 'plan.md'), 'utf8');
expect('Write "Status: approved" in plan.md is denied', run('pre-edit.cjs', write(`${T}/plan.md`, 'Status: approved · 2026-01-01\n')), 'deny');
expect('Write plan.md passes once the design is approved', run('pre-edit.cjs', write(`${T}/plan.md`, planTemplate)), 'pass');
put(`${T}/plan.md`, planTemplate.replace(/\{\{TITLE\}\}/g, 'Demo bug').replace(/\{\{DATE\}\}/g, today()).replace(/\{\{FOLDER\}\}/g, folder));
expect('Edit backend code with a draft plan still asks', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'ask');
r = run('on-prompt.cjs', prompt('/approve'));
expect('the third /approve approves plan.md', r, 'context', (x) => /APPROVED: plan/.test(x.out.hookSpecificOutput.additionalContext));
check('the third /approve sets the plan Status', /^Status: approved/m.test(read(`${T}/plan.md`)));
r = run('on-prompt.cjs', prompt('/approve'));
check('/approve with nothing left changes nothing', /nothing left to approve/.test(message(r)), message(r));

// ---------------------------------------------------------------- pre-edit: approved plan

expect('Edit backend code with an approved plan passes', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'pass');
expect('Write .docs/results/ files with an approved plan passes', run('pre-edit.cjs', write('.docs/results/table.csv', 'a')), 'pass');

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
expect('writing an approved status with sed is denied', run('pre-bash.cjs', bash(`sed -i '' 's/Design status: draft/Design status: approved/' ${T}/design.md`)), 'deny');
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

// ---------------------------------------------------------------- post-edit: determinism

put('eval/src/score.ts', 'export const t = Date.now();\nexport const r = Math.random();\nconst ok = [3, 1].sort((a, b) => a - b);\n');
r = run('post-edit.cjs', write('eval/src/score.ts', ''));
expect('Date.now and Math.random in eval/ are reported', r, 'block', (x) => /line 1/.test(reason(x)) && /line 2/.test(reason(x)) && !/line 3/.test(reason(x)));
put('eval/src/timing.ts', 'export const t = Date.now(); // harness-allow: progress log only\n');
expect('a harness-allow line is not reported', run('post-edit.cjs', write('eval/src/timing.ts', '')), 'pass');
put('eval/src/score.spec.ts', 'const t = Date.now();\n');
expect('test files are not checked', run('post-edit.cjs', write('eval/src/score.spec.ts', '')), 'pass');
put('apps/backend/src/ranking/core/sort.ts', 'export const s = (a: string[]) => a.sort();\n');
expect('.sort() with no compare function in ranking/ is reported', run('post-edit.cjs', write('apps/backend/src/ranking/core/sort.ts', '')), 'block');
put('packages/ranking/src/sort.ts', 'export const s = (a: string[]) => a.sort();\n');
expect('.sort() with no compare function in packages/ranking is reported', run('post-edit.cjs', write('packages/ranking/src/sort.ts', '')), 'block');
expect('code outside the determinism scope is not checked', run('post-edit.cjs', write('apps/backend/src/posts/x.ts', '')), 'pass');

// ---------------------------------------------------------------- post-edit: length limits

const lines = (n) => 'x\n'.repeat(n);
put(`${T}/design.md`, lines(800));
expect('design.md with 800 lines passes', run('post-edit.cjs', write(`${T}/design.md`, '')), 'pass');
put(`${T}/design.md`, lines(801));
expect('design.md with 801 lines is blocked', run('post-edit.cjs', write(`${T}/design.md`, '')), 'block', (x) => /801 lines/.test(reason(x)) && /limit for design.md is 800/.test(reason(x)));
put(`${T}/plan.md`, lines(600));
expect('plan.md with 600 lines passes', run('post-edit.cjs', write(`${T}/plan.md`, '')), 'pass');
put(`${T}/plan.md`, lines(601));
expect('plan.md with 601 lines is blocked', run('post-edit.cjs', write(`${T}/plan.md`, '')), 'block', (x) => /limit for plan.md is 600/.test(reason(x)));
put(`${T}/design.md`, design0.replace('Spec status: draft', `Spec status: approved`).replace('Design status: pending', `Design status: approved · ${today()}`));
put(`${T}/plan.md`, planTemplate.replace(/\{\{TITLE\}\}/g, 'Demo bug').replace(/\{\{DATE\}\}/g, today()).replace(/\{\{FOLDER\}\}/g, folder).replace('Status: draft', `Status: approved · ${today()}`));

// ---------------------------------------------------------------- session start

r = run('session-start.cjs', { source: 'startup' });
expect('session start reports the branch and the active task', r, 'context', (x) => {
  const c = x.out.hookSpecificOutput.additionalContext;
  return /Branch: test-app/.test(c) && new RegExp(`Active task: ${folder}`).test(c) && /Stage: implementing/.test(c) && !/old-task/.test(c);
});

// ---------------------------------------------------------------- task CLI: done

r = cli('done');
check('cli done refuses while items are unticked', r.status === 1 && /not ticked/.test(r.stderr), r.stderr);
put(`${T}/plan.md`, read(`${T}/plan.md`).replace(/- \[ \]/g, '- [x]'));
r = cli('done');
check('cli done closes the task when every box is ticked', r.status === 0 && /^Status: done/m.test(read(`${T}/plan.md`)) && !fs.existsSync(abs('.claude/state/active-task')), r.stdout + r.stderr);
check('cli done warns about an empty Result', /Result section is empty/.test(r.stdout), r.stdout);
expect('after done, code edits ask again', run('pre-edit.cjs', edit('apps/backend/src/posts/x.ts', '1', '2')), 'ask');
r = cli('use', folder);
check('cli use makes a task active again', r.status === 0 && read('.claude/state/active-task').trim() === folder, r.stdout + r.stderr);
r = cli('use', '2026-01-01-old-task');
check('cli use refuses an old task folder', r.status === 1, r.stdout + r.stderr);

// ---------------------------------------------------------------- the off switch

expect('BREADIT_HARNESS=off turns the hooks off', run('pre-edit.cjs', write('Latex/main.tex', 'x'), { BREADIT_HARNESS: 'off' }), 'pass');

// ---------------------------------------------------------------- summary

console.log(`\n${passed} passed, ${failed} failed`);
if (process.env.KEEP) console.log(`temp repo kept: ${root}`);
else fs.rmSync(root, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
