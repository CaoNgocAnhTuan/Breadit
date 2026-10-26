#!/usr/bin/env node
'use strict';
/**
 * Task folder helper for the author's workflow. It never approves anything: only the author's
 * /approve does (on-prompt.cjs).
 *
 *   node .claude/hooks/task.cjs new <slug> [--type feature|bug] [--id T6] [--title "..."]
 *   node .claude/hooks/task.cjs use <folder>          make an existing task the active one
 *   node .claude/hooks/task.cjs status [--all]        where the active task (and the others) stand
 *   node .claude/hooks/task.cjs done [--force]        close the task after the work is verified
 */
const fs = require('fs');
const path = require('path');
const h = require('./lib.cjs');

const [command, ...rest] = process.argv.slice(2);
const flags = parseFlags(rest);

const COMMANDS = { new: cmdNew, use: cmdUse, status: cmdStatus, done: cmdDone };
if (!COMMANDS[command]) die(usage());
COMMANDS[command]();

function cmdNew() {
  const slug = String(flags._[0] || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  if (!slug) die('usage: task.cjs new <slug> [--type feature|bug] [--id T6] [--title "..."]');
  const type = flags.type || 'feature';
  if (!h.TASK_TYPES.includes(type)) die(`unknown type "${type}". Use one of: ${h.TASK_TYPES.join(', ')}.`);

  const folder = `${h.today()}-${slug}`;
  const dir = h.taskDir(folder);
  if (fs.existsSync(dir)) die(`${h.WORKS}/${folder} already exists. To work on it: task.cjs use ${folder}`);
  fs.mkdirSync(dir, { recursive: true });
  const template = type === 'bug' ? 'bug.md' : 'task.md';
  fs.writeFileSync(
    path.join(dir, 'design.md'),
    h.fillTemplate(template, {
      TITLE: flags.title || slug.replace(/-/g, ' '),
      DATE: h.today(),
      FOLDER: folder,
      BUG_ID: flags.id || 'NEW',
    }),
  );
  h.writeState('active-task', folder);
  console.log(`Created ${h.WORKS}/${folder}/design.md from .claude/templates/${template}.`);
  console.log(`Active task: ${folder}. Fill in Spec and Impact, then stop for the author's review.`);
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
    console.log(`  ${h.statusLine(active)}`);
    console.log(`  type: ${active.type}`);
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

function cmdDone() {
  const task = h.activeTask();
  if (!task) die('no active task.');
  if (!h.canImplement(task)) die(`BLOCKED: plan.md is ${task.status.plan}. Only a task with an approved plan can be closed.`);
  const open = [...task.planText.matchAll(/^[ \t]*[-*][ \t]+\[ \][ \t]+(.+)$/gm)].map((m) => m[1].trim());
  if (open.length && !flags.force) die(`${open.length} item(s) are not ticked:\n${open.map((s) => `  - ${s}`).join('\n')}\nTick them, or run with --force and explain why in Result.`);
  const result = task.planText.split(/^##[ \t]+Result\b.*$/m)[1] || '';
  const resultBody = result.split(/^##[ \t]/m)[0].replace(/<!--[\s\S]*?-->/g, '').trim();
  fs.writeFileSync(task.planFile, h.setStatus('plan', task.planText, 'done', h.today()));
  h.clearState('active-task');
  console.log(`${task.folder} is done (plan.md: Status: done · ${h.today()}). No active task now.`);
  if (!resultBody) console.log('Warning: the Result section is empty. Fill it in: what was done, test counts, commits, changes from the plan.');
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
