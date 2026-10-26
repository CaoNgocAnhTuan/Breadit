#!/usr/bin/env node
'use strict';
/**
 * PostToolUse hook for Edit, Write and MultiEdit.
 *
 * - In eval/ and ranking code (not tests): reports code that breaks the determinism contract of
 *   super-plan §2 (wall clock, unseeded randomness, unstable sorts, locale functions).
 *   A line can opt out with "// harness-allow: <reason>".
 * - In task files: design.md may have at most 800 lines, plan.md at most 600.
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
  const kind = taskFile[2];
  const limit = h.LINE_LIMITS[kind];
  const lines = text.replace(/\n$/, '').split('\n').length;
  if (lines > limit) {
    h.done({
      decision: 'block',
      reason:
        `[harness] ${rel} has ${lines} lines. The limit for ${kind}.md is ${limit}. ` +
        'Shorten it: cut repeated text, long code, and detail the code itself already shows.',
    });
  }
}
h.done();
