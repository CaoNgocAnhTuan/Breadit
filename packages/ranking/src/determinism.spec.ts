import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Determinism rule (.claude/rules/determinism.md, super-plan section 2), DW7: a grep test over the package source.
// Spec files are not scanned: they may name a pattern to test for it. A line may opt out with
// "// harness-allow: <reason>", only for a real reason.
const PATTERNS: Array<[string, RegExp]> = [
  ['Date.now', /\bDate\.now\b/],
  ['new Date() with no argument', /new Date\(\s*\)/],
  ['performance.now', /\bperformance\.now\b/],
  ['Math.random', /\bMath\.random\b/],
  ['crypto.randomUUID', /\brandomUUID\b/],
  ['localeCompare', /\blocaleCompare\b/],
  ['toLocaleString', /\btoLocale\w*String\b/],
  ['Intl', /\bIntl\b/],
  ['.sort() with no compare function', /\.sort\(\s*\)/],
];

/** The module names a line imports or requires: `from 'x'`, `import 'x'`, `require('x')`, `import('x')`. */
function importedModules(line: string): string[] {
  const out: string[] = [];
  const re = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"])([^'"]+)\1/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line)) !== null) out.push(m[2]);
  return out;
}

export function violations(text: string): string[] {
  const out: string[] = [];
  text.split('\n').forEach((line, i) => {
    if (/\/\/\s*harness-allow:\s*\S/.test(line)) return;
    for (const [name, re] of PATTERNS) if (re.test(line)) out.push(`line ${i + 1}: ${name}`);
    for (const mod of importedModules(line)) {
      if (!(mod.startsWith('node:') || mod.startsWith('./'))) out.push(`line ${i + 1}: import of "${mod}" (only node: modules and ./ files)`);
    }
  });
  return out;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir, { withFileTypes: true })
    .map((e) => e.name)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))) {
    const path = join(dir, name);
    if (name.endsWith('.ts') && !name.endsWith('.spec.ts')) out.push(path);
  }
  return out;
}

describe('the detector', () => {
  it('finds each forbidden pattern and honours harness-allow', () => {
    expect(violations('const t = Date.now();').length).toBe(1);
    expect(violations('const d = new Date();').length).toBe(1);
    expect(violations('const d = new Date(5);').length).toBe(0);
    expect(violations('const x = Math.random();').length).toBe(1);
    expect(violations('a.sort();').length).toBe(1);
    expect(violations('a.sort((x, y) => x - y);').length).toBe(0);
    expect(violations('a.localeCompare(b)').length).toBe(1);
    expect(violations('n.toLocaleString()').length).toBe(1);
    expect(violations('new Intl.NumberFormat()').length).toBe(1);
    expect(violations('performance.now()').length).toBe(1);
    expect(violations('crypto.randomUUID()').length).toBe(1);
    expect(violations('const t = Date.now(); // harness-allow: log line only').length).toBe(0);
    expect(violations('const t = Date.now(); // harness-allow:').length).toBe(1);
  });

  it('allows node: modules and relative files, and finds every other import', () => {
    expect(violations("import { readFileSync } from 'node:fs';").length).toBe(0);
    expect(violations("import type { Post } from './types';").length).toBe(0);
    expect(violations("export { buildPool } from './pool';").length).toBe(0);
    expect(violations("export type { A } from './types';").length).toBe(0);
    expect(violations("import x from 'lodash';").length).toBe(1);
    expect(violations('import x from "@breadit/shared";').length).toBe(1);
    expect(violations("import 'reflect-metadata';").length).toBe(1);
    expect(violations("const x = require('fs');").length).toBe(1);
    expect(violations("const x = require('node:fs');").length).toBe(0);
    expect(violations("const x = await import('left-pad');").length).toBe(1);
    expect(violations("import { x } from '../outside';").length).toBe(1);
  });
});

describe('packages/ranking/src (DW7)', () => {
  it('has no forbidden pattern and no import outside node: modules and ./ files', () => {
    const files = sourceFiles(__dirname);
    expect(files.length).toBeGreaterThanOrEqual(8);
    const found: string[] = [];
    for (const f of files) for (const v of violations(readFileSync(f, 'utf8'))) found.push(`${f}: ${v}`);
    expect(found).toEqual([]);
  });
});
