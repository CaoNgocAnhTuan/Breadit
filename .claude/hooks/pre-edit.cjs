#!/usr/bin/env node
'use strict';
/**
 * PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit.
 *
 * 1. File guard: refuses edits to frozen or secret files (docs/, Latex/, .env, committed
 *    migrations, datasets/humans_v1.sql, the results manifest).
 * 2. Task files (.docs/works/<task>/{spec,design,plan}.md):
 *    - Claude never writes "Status: approved" (only the author's /approve does);
 *    - design.md needs an approved spec, plan.md an approved design;
 *    - an approved spec or design is read-only (reopen it first);
 *    - an approved plan only allows ticking boxes and writing the Result section.
 * 3. Approval gate: code and config edits ask the author unless the active task's plan is approved.
 */
const h = require('./lib.cjs');

const input = h.readInput();
if (h.HARNESS_OFF) h.done();
const ti = input.tool_input || {};
const rel = h.relPath(ti.file_path || ti.notebook_path, input.cwd);
if (!rel) h.done();

const why = h.protectedReason(rel);
if (why) h.deny(`${rel} is protected: ${why}.`);

const taskFile = h.TASK_FILE_RE.exec(rel);
if (taskFile) checkTaskFile(taskFile[1], taskFile[2]);

if (h.isGated(rel)) {
  const task = h.activeTask();
  if (!h.canImplement(task)) {
    const where = task ? `active task ${task.folder}: ${h.statusLine(task)}` : 'no active task';
    h.ask(
      `${rel} is code or config, and no plan is approved (${where}). ` +
        'The workflow is /task or /bugfix, then /design, /plan and /implement. ' +
        'Allow this only if the author wants the edit outside the workflow.',
    );
  }
}
h.done();

/** The old and new text of each change this tool call makes. */
function changes() {
  if (input.tool_name === 'Write') return [{ old: null, neu: ti.content || '' }];
  if (Array.isArray(ti.edits)) return ti.edits.map((e) => ({ old: e.old_string || '', neu: e.new_string || '' }));
  if (ti.new_string !== undefined) return [{ old: ti.old_string || '', neu: ti.new_string || '' }];
  return [];
}

function untick(s) {
  return (s || '').replace(/\[[xX ]\]/g, '[ ]');
}

function checkTaskFile(folder, stage) {
  const task = h.loadTask(folder) || { folder, files: {}, light: false, type: 'feature' };
  const list = changes();

  for (const c of list) {
    if (h.APPROVED_LINE_RE.test(c.neu) && !(c.old && h.APPROVED_LINE_RE.test(c.old))) {
      h.deny('only the author approves, by typing /approve. Claude never writes "Status: approved".');
    }
  }

  if (stage === 'design' || stage === 'plan') {
    if (task.light) h.deny(`${folder} is a light task: spec, design and plan all live in spec.md.`);
    const before = stage === 'design' ? 'spec' : 'design';
    const status = task.files[before] ? task.files[before].status : 'none';
    if (!h.isApproved(status)) {
      h.deny(`${stage}.md needs an approved ${before}.md first (now: ${status}). The author reviews ${before}.md and types /approve.`);
    }
  }

  const current = task.files[stage];
  if (!current || !h.isApproved(current.status)) return;

  const reopen = `node .claude/hooks/task.cjs reopen ${stage}`;
  const planLike = stage === 'plan' || (stage === 'spec' && task.light);
  if (!planLike || input.tool_name === 'Write') {
    h.deny(`${rel} is ${current.status}. To change it, run \`${reopen}\` (it goes back to draft), edit it, and ask the author to /approve again.`);
  }
  const resultAt = current.text.search(/^##[ \t]+Result\b/m);
  for (const c of list) {
    const tickOnly = untick(c.old) === untick(c.neu);
    const at = current.text.indexOf(c.old);
    const inResult = resultAt >= 0 && at >= resultAt;
    if (!tickOnly && !inResult) {
      h.deny(
        `${rel} is ${current.status}: only ticking boxes and writing the Result section are allowed. ` +
          `To change a step, run \`${reopen}\`, explain the change to the author, and wait for /approve.`,
      );
    }
  }
}
