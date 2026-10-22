#!/usr/bin/env node
'use strict';
/**
 * UserPromptSubmit hook: records the author's approval.
 *
 * When the author types `/approve` (or `/approve spec|design|plan`), this hook sets the status
 * line of that file in the active task to "Status: approved · <date>". Claude Code passes a
 * typed command to this hook as the author typed it, so Claude cannot trigger it: the Skill tool
 * cannot run /approve (disable-model-invocation, and pre-misc.cjs), and the Edit and Bash hooks
 * refuse any "Status: approved" that Claude writes itself.
 * Without an argument it approves the first file that is not approved yet (spec, then design, then plan).
 */
const fs = require('fs');
const h = require('./lib.cjs');

const input = h.readInput();
if (h.HARNESS_OFF) h.done();
const firstLine = String(input.prompt || '').split('\n')[0];
const m = /^\s*\/approve(?:\s+(\S+))?\s*$/i.exec(firstLine);
if (!m) h.done();

const result = approve((m[1] || '').toLowerCase());
h.done({
  systemMessage: result.user,
  hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: result.context },
});

function approve(arg) {
  const task = h.activeTask();
  if (!task) return fail('no active task. Choose one with `node .claude/hooks/task.cjs use <folder>`, then type /approve again.');
  if (arg && !h.STAGES.includes(arg)) return fail(`unknown step "${arg}". Use /approve, /approve spec, /approve design or /approve plan.`);

  const stage = arg || h.STAGES.find((s) => task.files[s] && !h.isApproved(task.files[s].status));
  if (!stage) return fail(`nothing to approve in ${task.folder} (${h.statusLine(task)}).`);
  if (task.light && stage !== 'spec') return fail(`${task.folder} is a light task: only spec.md is approved.`);
  const before = h.STAGES[h.STAGES.indexOf(stage) - 1];
  if (before && !(task.files[before] && h.isApproved(task.files[before].status))) {
    return fail(`${before}.md must be approved before ${stage}.md.`);
  }
  const file = task.files[stage];
  if (!file) return fail(`${stage}.md does not exist yet in ${task.folder}.`);
  if (h.isApproved(file.status)) return fail(`${stage}.md is already ${file.status}.`);
  if (file.status === 'missing') return fail(`${stage}.md has no "Status:" line. Add "Status: draft · <date>" near the top first.`);

  const date = h.today();
  fs.writeFileSync(file.file, h.setStatus(file.text, 'approved', date));
  const rel = `${h.WORKS}/${task.folder}/${stage}.md`;
  const next = stage === 'spec' ? (task.light ? '/implement' : '/design') : stage === 'design' ? '/plan' : '/implement';
  const note = hasReviewNotes(file.text) ? '' : ' Note: the file has no gate review notes.';
  return {
    user: `[harness] Approved ${rel} (${date}). Next: ${next}.${note}`,
    context:
      `The author approved ${rel} by typing /approve. The hook set its status line to "Status: approved · ${date}". ` +
      `The next command is ${next}; the author starts it.${note}`,
  };
}

function fail(message) {
  return {
    user: `[harness] /approve did nothing: ${message}`,
    context: `The /approve hook approved nothing: ${message}`,
  };
}

function hasReviewNotes(text) {
  const at = text.search(/^##[ \t]+Review notes\b/m);
  if (at < 0) return false;
  const body = text
    .slice(at)
    .split('\n')
    .slice(1)
    .join('\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  return body.length > 20;
}
