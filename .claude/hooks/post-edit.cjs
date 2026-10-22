#!/usr/bin/env node
'use strict';
/**
 * PostToolUse hook for Edit, Write and MultiEdit.
 *
 * - In eval/ and apps/backend/src/ranking/ (not tests): reports code that breaks the determinism
 *   contract of super-plan §2 (wall clock, unseeded randomness, unstable sorts, locale functions).
 *   A line can opt out with "// harness-allow: <reason>".
 * - In task files: lists the template sections the file does not have yet.
 */
const fs = require('fs');
const path = require('path');
const h = require('./lib.cjs');

const input = h.readInput();
if (h.HARNESS_OFF) h.done();
const ti = input.tool_input || {};
const rel = h.relPath(ti.file_path || ti.notebook_path, input.cwd);
if (!rel) h.done();

let text;
try {
  text = fs.readFileSync(path.join(h.projectDir(), rel), 'utf8');
} catch {
  h.done();
}

if (h.DETERMINISM_SCOPE_RE.test(rel) && h.CODE_EXT_RE.test(rel) && !h.TEST_FILE_RE.test(rel)) {
  const findings = h.determinismFindings(text);
  if (findings.length) {
    h.done({
      decision: 'block',
      reason:
        `[harness] Determinism check (super-plan §2) in ${rel}:\n` +
        `${findings.map((f) => `- line ${f.line}: ${f.why}`).join('\n')}\n` +
        'Fix these. If one is really needed, add "// harness-allow: <reason>" on that line.',
    });
  }
  h.done();
}

const taskFile = h.TASK_FILE_RE.exec(rel);
if (taskFile) {
  const task = h.loadTask(taskFile[1]);
  const missing = h.missingSections(taskFile[2], task, text);
  if (missing.length) {
    h.done({
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `[harness] ${rel} does not have these template sections yet: ${missing.join(', ')}. Template: .claude/templates/${h.templateFor(taskFile[2], task)}.`,
      },
    });
  }
}
h.done();
