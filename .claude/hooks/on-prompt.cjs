#!/usr/bin/env node
'use strict';
/**
 * UserPromptSubmit hook: records the author's approval.
 *
 * When the author types `/approve`, this hook sets the next status line of the active task to
 * "approved · <date>": Spec status (Spec + Impact in design.md), then Design status (the Design
 * section of design.md), then Status of plan.md. Claude Code passes a typed command to this hook as
 * the author typed it, so Claude cannot trigger it: the Skill tool cannot run /approve
 * (disable-model-invocation), and the Edit and Bash hooks refuse any "approved" that Claude writes.
 * It then tells Claude what was approved, and commands/approve.md says what to do next.
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

/** The stage /approve would approve now, or { problem } if there is none. */
function nextStage(task) {
  const s = task.status;
  if (s.spec === 'draft') return { stage: 'spec' };
  if (s.design === 'pending') return { problem: 'the Design section is not written yet. Ask Claude to write it from the approved spec.' };
  if (s.design === 'draft') return { stage: 'design' };
  if (s.plan === 'none') return { problem: 'plan.md is not written yet. Ask Claude to write it from the approved design.' };
  if (s.plan === 'draft') return { stage: 'plan' };
  return { problem: `nothing left to approve (${h.statusLine(task)}).` };
}

function approve(arg) {
  const task = h.activeTask();
  if (!task) return fail('no active task. Choose one with `node .claude/hooks/task.cjs use <folder>`, then type /approve again.');
  if (arg && !h.STAGES.includes(arg)) return fail(`unknown step "${arg}". Use /approve, /approve spec, /approve design or /approve plan.`);

  const next = nextStage(task);
  if (next.problem) return fail(next.problem);
  if (arg && arg !== next.stage) return fail(`the next step to approve is ${next.stage}, not ${arg}.`);

  const stage = next.stage;
  const file = h.STATUS_FILE[stage] === 'plan' ? task.planFile : task.designFile;
  const text = h.STATUS_FILE[stage] === 'plan' ? task.planText : task.designText;
  const date = h.today();
  const updated = h.setStatus(stage, text, 'approved', date);
  if (!updated) return fail(`${file} has no status line for ${stage}.`);
  fs.writeFileSync(file, updated);

  const what = { spec: 'Spec and Impact (design.md)', design: 'the Design section (design.md)', plan: 'plan.md' }[stage];
  const nextStepText = {
    spec: 'Claude writes the Design section',
    design: 'Claude writes plan.md',
    plan: 'Claude has Sonnet implement the plan, then verifies',
  }[stage];
  return {
    user: `[harness] Approved ${what} of ${task.folder} (${date}). Next: ${nextStepText}.`,
    context:
      `APPROVED: ${stage}. The author approved ${what} of ${h.WORKS}/${task.folder} by typing /approve. ` +
      `The hook set the status line to "approved · ${date}". Next: ${nextStepText}.`,
  };
}

function fail(message) {
  return {
    user: `[harness] /approve did nothing: ${message}`,
    context: `The /approve hook approved nothing: ${message}`,
  };
}
