#!/usr/bin/env node
'use strict';
/**
 * Task folder helper for the author's workflow. It never approves anything: only the author's
 * /approve does (on-prompt.cjs).
 *
 *   node .claude/hooks/task.cjs new <slug> [--type feature|bug|experiment|writing] [--light] [--id T6] [--title "..."]
 *   node .claude/hooks/task.cjs use <folder>          make an existing task the active one
 *   node .claude/hooks/task.cjs status [--all]        where the active task (and the others) stand
 *   node .claude/hooks/task.cjs check design|plan|implement
 *   node .claude/hooks/task.cjs scaffold design|plan  copy the template, once the step before is approved
 *   node .claude/hooks/task.cjs reopen spec|design|plan
 *   node .claude/hooks/task.cjs done [--force]        close the task after /implement
 */
const fs = require('fs');
const path = require('path');
const h = require('./lib.cjs');

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

const COMMANDS = { new: cmdNew, use: cmdUse, status: cmdStatus, check: cmdCheck, scaffold: cmdScaffold, reopen: cmdReopen, done: cmdDone };
if (!COMMANDS[command]) die(usage());
COMMANDS[command]();

function cmdNew() {
  const slug = String(flags._[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) die('usage: task.cjs new <slug> [--type feature|bug|experiment|writing] [--light] [--id T6] [--title "..."]');
  const type = flags.type || 'feature';
  if (!h.TASK_TYPES.includes(type)) die(`unknown type "${type}". Use one of: ${h.TASK_TYPES.join(', ')}.`);
  if (flags.light && !['feature', 'bug'].includes(type)) die('light mode is only for small features and bugs (effort XS).');

  const folder = `${h.today()}-${slug}`;
  const dir = h.taskDir(folder);
  if (fs.existsSync(dir)) die(`${h.WORKS}/${folder} already exists. To work on it: task.cjs use ${folder}`);
  fs.mkdirSync(dir, { recursive: true });
  const template = flags.light ? 'spec-light.md' : `spec-${type}.md`;
  fs.writeFileSync(
    path.join(dir, 'spec.md'),
    h.fillTemplate(template, {
      TITLE: flags.title || slug.replace(/-/g, ' '),
      DATE: h.today(),
      FOLDER: folder,
      TYPE: type,
      BUG_ID: flags.id || 'NEW',
    }),
  );
  h.writeState('active-task', folder);
  console.log(`Created ${h.WORKS}/${folder}/spec.md from .claude/templates/${template}.`);
  console.log(`Active task: ${folder}. Fill in spec.md, then stop for the author's review.`);
}

function cmdUse() {
  const folder = path.basename(String(flags._[0] || ''));
  const task = h.loadTask(folder);
  if (!task) die(`no task folder ${h.WORKS}/${folder}. Existing tasks:\n${h.listTasks().map((t) => `  ${t.folder}`).join('\n') || '  (none)'}`);
  h.writeState('active-task', folder);
  console.log(`Active task: ${folder} (${h.statusLine(task)}).`);
}

function cmdStatus() {
  const active = h.activeTask();
  if (active) {
    const d = h.describe(active);
    console.log(`Active task: ${h.WORKS}/${active.folder}`);
    for (const s of h.STAGES) {
      if (active.files[s]) console.log(`  ${s}.md: ${(/^Status:.*$/m.exec(active.files[s].text) || ['Status: missing'])[0]}`);
    }
    console.log(`  type: ${active.type}${active.light ? ' (light mode)' : ''}`);
    console.log(`  stage: ${d.stage}${d.next ? `\n  next: ${d.next}` : ''}`);
    console.log(`  code edits: ${h.canImplement(active) ? 'allowed (approved plan)' : 'ask the author (no approved plan)'}`);
  } else {
    console.log('No active task.');
  }
  const others = h.listTasks().filter((t) => !active || t.folder !== active.folder);
  const shown = flags.all ? others : others.filter((t) => h.describe(t).stage !== 'done');
  if (shown.length) {
    console.log(flags.all ? 'Other tasks:' : 'Other open tasks:');
    for (const t of shown) console.log(`  ${t.folder}: ${h.describe(t).stage}`);
  }
}

/** Why the step cannot start, or null. */
function blockedReason(step, task) {
  if (!task) return 'no active task. Start one with /task or /bugfix, or run `task.cjs use <folder>`.';
  const st = (s) => (task.files[s] ? task.files[s].status : 'none');
  if (step === 'design' || step === 'plan') {
    if (task.light) return `${task.folder} is a light task: spec.md holds the design and the plan. Next: /implement after /approve.`;
    const before = step === 'design' ? 'spec' : 'design';
    if (!h.isApproved(st(before))) return `${before}.md is ${st(before)}. The author reviews it and types /approve first.`;
    return null;
  }
  if (step === 'implement') {
    if (h.canImplement(task)) return null;
    const f = task.light ? 'spec' : 'plan';
    if (st(f) === 'done') return `${task.folder} is done.`;
    return `${f}.md is ${st(f)}. The author reviews it and types /approve first.`;
  }
  return `unknown step "${step}". Use design, plan or implement.`;
}

function cmdCheck() {
  const step = flags._[0];
  const task = h.activeTask();
  const why = blockedReason(step, task);
  if (why) {
    console.log(`BLOCKED: ${why}`);
    process.exit(1);
  }
  console.log(`OK: ${step} can start for ${task.folder} (${h.statusLine(task)}).`);
}

function cmdScaffold() {
  const step = flags._[0];
  if (step !== 'design' && step !== 'plan') die('usage: task.cjs scaffold design|plan');
  const task = h.activeTask();
  const why = blockedReason(step, task);
  if (why) die(`BLOCKED: ${why}`);
  const file = path.join(task.dir, `${step}.md`);
  if (fs.existsSync(file)) {
    console.log(`${h.WORKS}/${task.folder}/${step}.md already exists (${h.statusOf(fs.readFileSync(file, 'utf8'))}).`);
    return;
  }
  const title = (/^#\s+(?:[^:\n]*:\s*)?(.+)$/m.exec(task.files.spec.text) || [null, task.folder])[1].trim();
  const template = h.templateFor(step, task);
  fs.writeFileSync(file, h.fillTemplate(template, { TITLE: title, DATE: h.today(), FOLDER: task.folder, TYPE: task.type }));
  console.log(`Created ${h.WORKS}/${task.folder}/${step}.md from .claude/templates/${template}.`);
}

function cmdReopen() {
  const step = flags._[0];
  if (!h.STAGES.includes(step)) die('usage: task.cjs reopen spec|design|plan');
  const task = h.activeTask();
  if (!task) die('no active task.');
  if (!task.files[step]) die(`${step}.md does not exist in ${task.folder}.`);
  const changed = [];
  for (const s of h.STAGES.slice(h.STAGES.indexOf(step))) {
    const f = task.files[s];
    if (f && f.status !== 'draft') {
      fs.writeFileSync(f.file, h.setStatus(f.text, 'draft', h.today()));
      changed.push(`${s}.md (${f.status} → draft)`);
    }
  }
  console.log(changed.length ? `Reopened in ${task.folder}: ${changed.join(', ')}. The author must /approve again.` : `${step}.md is already a draft.`);
}

function cmdDone() {
  const task = h.activeTask();
  if (!task) die('no active task.');
  if (!h.canImplement(task)) die(`BLOCKED: ${blockedReason('implement', task)}`);
  const f = task.light ? task.files.spec : task.files.plan;
  const open = [...f.text.matchAll(/^[ \t]*[-*][ \t]+\[ \][ \t]+(.+)$/gm)].map((m) => m[1].trim());
  if (open.length && !flags.force) die(`${open.length} step(s) are not ticked:\n${open.map((s) => `  - ${s}`).join('\n')}\nTick them, or run with --force and explain why in Result.`);
  const result = f.text.split(/^##[ \t]+Result\b.*$/m)[1] || '';
  const resultBody = result.split(/^##[ \t]/m)[0].replace(/<!--[\s\S]*?-->/g, '').trim();
  fs.writeFileSync(f.file, h.setStatus(f.text, 'done', h.today()));
  h.clearState('active-task');
  console.log(`${task.folder} is done (${path.basename(f.file)}: Status: done · ${h.today()}). No active task now.`);
  if (!resultBody) console.log('Warning: the Result section is empty. Fill it in: what was done, test counts, hashes, changes from the plan.');
}

function parseFlags(args) {
  const out = { _: [] };
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('--') && ['type', 'id', 'title'].includes(key)) {
        out[key] = next;
        i += 1;
      } else {
        out[key] = true;
      }
    } else {
      out._.push(a);
    }
  }
  return out;
}

function usage() {
  return fs
    .readFileSync(__filename, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith(' *   node'))
    .map((l) => l.slice(4))
    .join('\n');
}

function die(message) {
  console.error(message);
  process.exit(1);
}
