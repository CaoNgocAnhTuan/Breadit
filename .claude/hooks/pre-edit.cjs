#!/usr/bin/env node
'use strict';
/**
 * PreToolUse hook for Edit, Write, MultiEdit and NotebookEdit.
 *
 * 1. File guard: refuses edits to frozen or secret files (docs/, Latex/, .env, committed
 *    migrations, datasets/humans_v1.sql, the results manifest).
 * 2. Task files (.docs/works/<task>/{design,plan}.md):
 *    - Claude never writes an "approved" status line (only the author's /approve does);
 *    - the Design section cannot start before the spec is approved;
 *    - plan.md needs an approved design.
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
        'The workflow is /task or /bugfix, then /approve three times (spec, design, plan). ' +
        'Allow this only if the author wants the edit outside the workflow.',
    );
  }
}
h.done();

/** The new text of each change this tool call makes (with the old text, when there is one). */
function changes() {
  if (input.tool_name === 'Write') return [{ old: null, neu: ti.content || '' }];
  if (Array.isArray(ti.edits)) return ti.edits.map((e) => ({ old: e.old_string || '', neu: e.new_string || '' }));
  if (ti.new_string !== undefined) return [{ old: ti.old_string || '', neu: ti.new_string || '' }];
  return [];
}

function checkTaskFile(folder, stage) {
  const task = h.loadTask(folder);
  const list = changes();

  for (const c of list) {
    if (h.APPROVED_LINE_RE.test(c.neu) && !(c.old && h.APPROVED_LINE_RE.test(c.old))) {
      h.deny('only the author approves, by typing /approve. Claude never writes an "approved" status line.');
    }
  }
  if (!task) return; // an old folder, or a task that is not started yet

  if (stage === 'design' && task.status.spec !== 'approved') {
    for (const c of list) {
      if (/^Design status:[ \t]*(draft|approved)\b/im.test(c.neu) && !(c.old && /^Design status:[ \t]*draft\b/im.test(c.old))) {
        h.deny(`the Design section needs an approved spec first (Spec status: ${task.status.spec}). The author reviews Spec and Impact and types /approve.`);
      }
    }
  }
  if (stage === 'plan' && task.status.design !== 'approved') {
    h.deny(`plan.md needs an approved design first (Design status: ${task.status.design}). The author reviews the Design section and types /approve.`);
  }
}
