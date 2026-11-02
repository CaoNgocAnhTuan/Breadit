import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// Determinism rule (.claude/rules/determinism.md, super-plan section 2): DW8.
// A line may opt out with "// harness-allow: <reason>". This file's own pattern list is the only exception.
const PATTERNS: Array<[string, RegExp]> = [
  ["Date.now", /\bDate\.now\b/],
  ["new Date() with no argument", /new Date\(\s*\)/],
  ["performance.now", /\bperformance\.now\b/],
  ["Math.random", /\bMath\.random\b/],
  ["crypto.randomUUID", /\brandomUUID\b/],
  ["localeCompare", /\blocaleCompare\b/],
  ["toLocaleString", /\btoLocale\w*String\b/],
  ["Intl", /\bIntl\b/],
  [".sort() with no compare function", /\.sort\(\s*\)/],
];

export function violations(text: string): string[] {
  const out: string[] = [];
  text.split("\n").forEach((line, i) => {
    if (/\/\/\s*harness-allow:\s*\S/.test(line)) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) out.push(`line ${i + 1}: ${name}`);
  });
  return out;
}

function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsFiles(path));
    else if (name.endsWith(".ts")) out.push(path);
  }
  return out;
}

test("the detector finds each forbidden pattern and honours harness-allow", () => {
  assert.equal(violations("const t = Date.now();").length, 1);
  assert.equal(violations("const d = new Date();").length, 1);
  assert.equal(violations("const d = new Date(5);").length, 0);
  assert.equal(violations("const x = Math.random();").length, 1);
  assert.equal(violations("a.sort();").length, 1);
  assert.equal(violations("a.sort((x, y) => x - y);").length, 0);
  assert.equal(violations("a.localeCompare(b)").length, 1);
  assert.equal(violations("n.toLocaleString()").length, 1);
  assert.equal(violations("new Intl.NumberFormat()").length, 1);
  assert.equal(violations("performance.now()").length, 1);
  assert.equal(violations("crypto.randomUUID()").length, 1);
  assert.equal(violations("const t = Date.now(); // harness-allow: log line only").length, 0);
  assert.equal(violations("const t = Date.now(); // harness-allow:").length, 1);
});

test("no forbidden pattern in eval/src (DW8)", () => {
  const root = new URL(".", import.meta.url).pathname;
  const self = new URL(import.meta.url).pathname;
  const files = tsFiles(root).filter((f) => f !== self);
  assert.ok(files.length > 10);
  const found: string[] = [];
  for (const f of files) for (const v of violations(readFileSync(f, "utf8"))) found.push(`${f}: ${v}`);
  assert.deepEqual(found, []);
});
