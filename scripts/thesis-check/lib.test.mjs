// Tests of scripts/thesis-check/lib.mjs (task p10-final-checks, plan steps 1-2, TC1-TC10;
// task p10-overlap-quotes-only, plan step 2, the tests named "quotes-only TC1" to "quotes-only TC5").
// Run: node --test 'scripts/thesis-check/*.test.mjs'   (Node 22, no db, no LaTeX build, no real thesis file)
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  applyAllowList,
  checkAbstract,
  checkCitations,
  checkMacros,
  checkNumbers,
  checkOverlap,
  checkPages,
  formatFindings,
  formatReport,
  inQuote,
  macroUses,
  numberCandidates,
  overlaps,
  parseAllowList,
  parseMacros,
  parsePages,
  parseReferences,
  parseSection10,
  quotePieces,
  refKeys,
  sourcePieces,
  statusOf,
  stripComments,
  stripTex,
  words,
} from './lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const levels = (findings, level) => findings.filter((f) => f.level === level);

// TC1: stripTex
test('TC1 stripTex keeps the number of lines', () => {
  const text = 'a\n% only a comment\n\nb 0.5 % tail\n\\begin{verbatim}\nx\n\\end{verbatim}\nend';
  assert.equal(stripTex(text).length, text.split('\n').length);
  assert.equal(stripComments(text).length, text.split('\n').length);
});

test('TC1 stripTex removes a % comment but keeps an escaped \\%', () => {
  const lines = stripTex('a 0.5 % comment 0.7\nprice 50\\% ok % tail\n\\\\ % after a line break');
  assert.equal(lines[0].trim(), 'a 0.5');
  assert.equal(lines[1].trim(), 'price 50\\% ok');
  assert.equal(lines[2].trim(), '\\\\');
});

test('TC1 stripTex blanks the arguments of url, path, href, label, ref, refcite, input, includegraphics, thesisdiagram', () => {
  const src = [
    'see \\url{http://x.org/1.2.3} then',
    'a \\label{ref:a2019} b \\ref{x:1.5} c \\refcite{k0.3} d',
    '\\input{\\resultsdir/t1.5.tex} \\includegraphics[width=0.8\\textwidth]{img0.9.png}',
    '\\thesisdiagram{d1.5}{0.9\\textwidth} \\path{/a/1.5} \\href{http://h/2.5}{text 3.5}',
  ].join('\n');
  const out = stripTex(src);
  assert.equal(out.length, 4);
  const joined = out.join('\n');
  for (const gone of ['1.2.3', '2019', '1.5', '0.3', 'resultsdir', '0.8', '0.9', 'img', 'http://h/2.5']) {
    assert.equal(joined.includes(gone), false, `${gone} should be blanked`);
  }
  assert.ok(out[0].includes('see') && out[0].includes('then'));
  assert.ok(out[3].includes('text 3.5'), 'the visible text of an href stays');
});

test('TC1 stripTex blanks the body of verbatim and lstlisting, not the text around them', () => {
  const src = 'before 0.5\n\\begin{verbatim}\nx = 1.25 % keep\n\\end{verbatim}\nmid 0.6\n\\begin{lstlisting}[caption={c}]\ny = 1.75\nz = 2.5\n\\end{lstlisting}\nafter 0.7';
  const out = stripTex(src);
  assert.equal(out.length, src.split('\n').length);
  assert.ok(out[0].includes('0.5') && out[4].includes('0.6') && out[9].includes('0.7'));
  assert.equal(out[2].trim(), '');
  assert.equal(out[6].trim(), '');
  assert.equal(out[7].trim(), '');
});

// TC2: numberCandidates
test('TC2 numberCandidates finds a decimal and a percentage with their line', () => {
  const c = numberCandidates(['no number here', 'The gain is 0.054 and the level 95\\%.', 'also 0.5\\% and $-0.001$'], 'a.tex');
  assert.deepEqual(c.map((x) => [x.line, x.number]), [[2, '0.054'], [2, '95\\%'], [3, '0.5\\%'], [3, '0.001']]);
  assert.equal(c[0].file, 'a.tex');
  assert.equal(c[0].text, 'The gain is 0.054 and the level 95\\%.');
});

test('TC2 numberCandidates skips versions, integers, numbers joined to a letter and a second dot', () => {
  const lines = ['Next.js 15.1.6 and v3.13 and Node 22 with K = 10 in 2026.', 'gap 0.054x and 1.5.2 and x0.5 and 1e3'];
  assert.deepEqual(numberCandidates(lines, 'a.tex'), []);
});

test('TC2 numberCandidates skips a number inside a blanked URL and keeps one after it', () => {
  const lines = stripTex('see \\url{https://x.org/v1.5/2.7} and 0.3');
  assert.deepEqual(numberCandidates(lines, 'a.tex').map((x) => x.number), ['0.3']);
});

// TC3: parseAllowList + applyAllowList
const TSV = [
  'file\tnumber\tcontext\treason',
  'a.tex\t0.25\tweight of the term\ta setting in the formula',
  '# a comment line',
  '',
  'a.tex\t95\\%\tinterval\t',
  'b.tex\t3.5\tnothing here\ta number that is not in any file',
].join('\n');

test('TC3 parseAllowList reads four fields, skips the header, comments and blank lines', () => {
  const e = parseAllowList(TSV);
  assert.equal(e.length, 3);
  assert.deepEqual(e[0], { file: 'a.tex', number: '0.25', context: 'weight of the term', reason: 'a setting in the formula', line: 2 });
  assert.equal(e[1].reason, '');
  assert.equal(e[1].line, 5);
});

test('TC3 applyAllowList allows a candidate with the same file, number and context on its line', () => {
  const entries = parseAllowList(TSV);
  const cands = [
    { file: 'a.tex', path: 'p/a.tex', line: 3, number: '0.25', text: 'the weight of the term is 0.25 here' },
    { file: 'a.tex', path: 'p/a.tex', line: 9, number: '0.25', text: 'another 0.25 elsewhere' },
    { file: 'c.tex', path: 'p/c.tex', line: 1, number: '0.25', text: 'the weight of the term is 0.25 here' },
  ];
  const r = applyAllowList(cands, entries, 'allow.tsv');
  assert.deepEqual(r.remaining.map((c) => c.line + c.file), ['9a.tex', '1c.tex']);
  assert.equal(r.allowed, 1);
});

test('TC3 applyAllowList gives FAIL for an entry with no reason and WARN for an entry that matches nothing', () => {
  const r = applyAllowList([], parseAllowList(TSV), 'allow.tsv');
  const fail = levels(r.findings, 'FAIL');
  const warn = levels(r.findings, 'WARN');
  assert.equal(fail.length, 1);
  assert.equal(fail[0].path, 'allow.tsv');
  assert.equal(fail[0].line, 5);
  assert.match(fail[0].message, /reason/);
  assert.equal(warn.length, 2); // the 0.25 entry and the b.tex entry: nothing matched
  assert.ok(warn.every((w) => /matches nothing/.test(w.message)));
});

test('TC3 an entry with no reason does not allow its number', () => {
  const entries = parseAllowList('a.tex\t95\\%\tinterval\t');
  const r = applyAllowList([{ file: 'a.tex', path: 'a.tex', line: 1, number: '95\\%', text: 'the interval is 95\\%' }], entries, 'allow.tsv');
  assert.equal(r.remaining.length, 1);
});

test('TC3 checkNumbers FAILs on a typed number and PASSes when it is allowed', () => {
  const files = [{ file: 'a.tex', path: 'chapters/a.tex', lines: ['The weight of the term is 0.25 and 95\\% hold.'] }];
  const defined = new Set();
  const bad = checkNumbers({ files, entries: [], defined, allowPath: 'allow.tsv' });
  assert.equal(bad.status, 'FAIL');
  assert.equal(levels(bad.findings, 'FAIL').length, 2);
  assert.equal(bad.findings[0].path, 'chapters/a.tex');
  const entries = parseAllowList('a.tex\t0.25\tweight of the term\tsetting\na.tex\t95\\%\tand 95\tsetting');
  const good = checkNumbers({ files, entries, defined, allowPath: 'allow.tsv' });
  assert.equal(good.status, 'PASS');
  assert.deepEqual(good.findings, []);
});

// TC4: macroUses + parseMacros + checkMacros
const MACROS_TEX = [
  '% Written by the report script.',
  '\\newcommand{\\eOneAValue}{0.1}',
  '\\newcommand{\\eOneWTwoMNdcgHTenAllValue}{0.2}',
  '\\newcommand{\\tuneAlpha}{1024}',
  '\\providecommand{\\macromissing}[1]{\\textcolor{red}{[MACRO?: #1]}}',
].join('\n');

test('TC4 parseMacros reads the names of newcommand and providecommand', () => {
  const m = parseMacros(MACROS_TEX);
  assert.ok(m instanceof Set);
  assert.ok(m.has('eOneAValue') && m.has('eOneWTwoMNdcgHTenAllValue') && m.has('tuneAlpha'));
  assert.equal(m.has('textcolor'), false);
});

test('TC4 macroUses takes the longest letter run as the name and only the result prefixes', () => {
  const uses = macroUses(['\\eOneAValue{} and \\eOneUnknownValue{}', 'the \\eOneWTwoMNdcgHTenAllValue{}x \\eTwoDiggFoo2', '\\textbf{\\emph{a}} \\eqref{x} \\tuneAlpha{} \\hZeroH{} \\orientDiggZeroFiveN{}']);
  assert.deepEqual(uses.map((u) => [u.line, u.name]), [
    [1, 'eOneAValue'],
    [1, 'eOneUnknownValue'],
    [2, 'eOneWTwoMNdcgHTenAllValue'],
    [2, 'eTwoDiggFoo'],
    [3, 'tuneAlpha'],
    [3, 'hZeroH'],
    [3, 'orientDiggZeroFiveN'],
  ]);
});

test('TC4 checkMacros passes a defined macro and gives FAIL for an unknown one', () => {
  const defined = parseMacros(MACROS_TEX);
  assert.deepEqual(checkMacros(['gain \\eOneAValue{} here'], defined, 'a.tex'), []);
  const f = checkMacros(['gain \\eOneUnknownValue{} here', 'ok \\eOneAValue{}'], defined, 'a.tex');
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].level, f[0].path, f[0].line], ['FAIL', 'a.tex', 1]);
  assert.match(f[0].message, /eOneUnknownValue/);
});

test('TC4 a longer name is a different macro (the letter after the name is part of it)', () => {
  const defined = new Set(['eOneWTwoMNdcgHTenAllValue']);
  const f = checkMacros(['\\eOneWTwoMNdcgHTenAllValueX{}'], defined, 'a.tex');
  assert.equal(f.length, 1);
  assert.match(f[0].message, /eOneWTwoMNdcgHTenAllValueX/);
});

test('TC4 macromissing used in the text gives FAIL, its providecommand line does not', () => {
  const defined = parseMacros(MACROS_TEX);
  const f = checkMacros(['\\providecommand{\\macromissing}[1]{x}', 'text \\macromissing{p value} text'], defined, 'a.tex');
  assert.equal(f.length, 1);
  assert.equal(f[0].line, 2);
  assert.match(f[0].message, /macromissing/);
});

// TC5: refKeys, parseReferences, checkCitations
const REFS_TEX = [
  '% How to cite: write \\item\\label{ref:<key>} for each reference here',
  '\\begin{enumerate}',
  '  \\item\\label{ref:a2020} Author (2020). Title with 50\\% in it. \\url{https://x.org} % §10 [1]',
  '  \\item\\label{ref:b2021} Other (2021). Another. % §10 [3]',
  '  \\item\\label{ref:c2022} No link (2022). Title.',
  '\\end{enumerate}',
].join('\n');

test('TC5 parseReferences reads each item, its line and its § 10 number, and skips comments', () => {
  assert.deepEqual(parseReferences(REFS_TEX), [
    { key: 'a2020', section10: 1, line: 3 },
    { key: 'b2021', section10: 3, line: 4 },
    { key: 'c2022', section10: null, line: 5 },
  ]);
});

test('TC5 refKeys gives each key with its line and the sentence that holds it', () => {
  const k = refKeys(['We follow it \\refcite{a2020}. And more', 'work \\refcite{b2021} too.', '', 'Next paragraph.']);
  assert.deepEqual(k.map((x) => [x.key, x.line]), [['a2020', 1], ['b2021', 2]]);
  assert.equal(k[0].sentence, 'We follow it \\refcite{a2020}.');
  assert.equal(k[1].sentence, 'And more work \\refcite{b2021} too.');
});

const SEC10 = new Map([
  [1, 'verified'],
  [2, 'search only (the paper was not opened; do not cite)'],
  [3, 'verified (abstract only; do not cite a finding from it)'],
]);
const use = (key, path = 'chapters/x.tex', line = 5, sentence = `Sentence of ${key}.`) => ({ key, path, line, sentence });
const ref = (key, section10, line = 7) => ({ key, section10, line });

test('TC5 checkCitations passes when every key is used, defined and verified, and lists the do-not-cite sentences as INFO', () => {
  const r = checkCitations({ uses: [use('a2020'), use('b2021', 'chapters/y.tex', 9, 'We cite b2021 here.')], refs: [ref('a2020', 1), ref('b2021', 3)], section10: SEC10, refsPath: 'chapters/references.tex' });
  assert.equal(r.status, 'PASS');
  assert.equal(levels(r.findings, 'FAIL').length, 0);
  const info = levels(r.findings, 'INFO');
  assert.equal(info.length, 1);
  assert.deepEqual([info[0].path, info[0].line], ['chapters/y.tex', 9]);
  assert.match(info[0].message, /We cite b2021 here\./);
  assert.match(r.summary, /2 keys used, 2 defined, 2 verified/);
});

test('TC5 checkCitations gives FAIL for a used key that is not defined', () => {
  const r = checkCitations({ uses: [use('a2020'), use('zzz', 'chapters/y.tex', 3)], refs: [ref('a2020', 1)], section10: SEC10, refsPath: 'r.tex' });
  assert.equal(r.status, 'FAIL');
  const f = levels(r.findings, 'FAIL');
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].path, f[0].line], ['chapters/y.tex', 3]);
  assert.match(f[0].message, /zzz/);
});

test('TC5 checkCitations gives FAIL for a defined key that is never used', () => {
  const r = checkCitations({ uses: [use('a2020')], refs: [ref('a2020', 1), ref('b2021', 3, 8)], section10: SEC10, refsPath: 'r.tex' });
  const f = levels(r.findings, 'FAIL');
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].path, f[0].line], ['r.tex', 8]);
  assert.match(f[0].message, /b2021/);
});

test('TC5 checkCitations gives FAIL for an entry with no § 10 comment and for a number that is not an item', () => {
  const r = checkCitations({ uses: [use('a'), use('b')], refs: [ref('a', null, 7), ref('b', 99, 8)], section10: SEC10, refsPath: 'r.tex' });
  const f = levels(r.findings, 'FAIL');
  assert.equal(f.length, 2);
  assert.match(f[0].message, /no .*§10/);
  assert.match(f[1].message, /\[99\]/);
});

test('TC5 checkCitations gives FAIL for a search only item and passes a status that starts with verified', () => {
  const bad = checkCitations({ uses: [use('a')], refs: [ref('a', 2)], section10: SEC10, refsPath: 'r.tex' });
  assert.equal(bad.status, 'FAIL');
  assert.match(levels(bad.findings, 'FAIL')[0].message, /search only/);
  const good = checkCitations({ uses: [use('a')], refs: [ref('a', 1)], section10: new Map([[1, 'verified (record only; no full text found)']]), refsPath: 'r.tex' });
  assert.equal(good.status, 'PASS');
});

test('TC5 checkCitations on the slides needs no entry to be cited, but a used key must be defined and verified', () => {
  const ok = checkCitations({ uses: [], refs: [ref('a', 1)], section10: SEC10, refsPath: 'r.tex', scope: 'slides' });
  assert.equal(ok.status, 'PASS');
  const bad = checkCitations({ uses: [use('nope', 'slides/s.tex', 4)], refs: [ref('a', 1)], section10: SEC10, refsPath: 'r.tex', scope: 'slides' });
  assert.equal(bad.status, 'FAIL');
});

// TC6: parseSection10
const SUPER_PLAN = [
  '## 9. Out of scope',
  '1. nothing here · verified',
  '## 10. Appendix: references',
  'Intro text. 1. not an item because it does not start the line',
  '1. Tang (2013). Title. https://x.org · verified',
  '2. Ma (2008). Title. · search only (the paper was not opened; do not cite)',
  '3. Foo (2020). Title. · verified (abstract only; do not cite a finding from it)',
  '4. A · B (2021). Title · verified (read in full)',
  '- 5. a bullet, not an item',
  '---',
  '## 11. Open items',
  '5. not in section 10 · verified',
].join('\n');

test('TC6 parseSection10 reads only numbered lines between ## 10. and the next ## heading', () => {
  const m = parseSection10(SUPER_PLAN);
  assert.deepEqual([...m.keys()], [1, 2, 3, 4]);
});

test('TC6 parseSection10 takes the status after the last middle dot', () => {
  const m = parseSection10(SUPER_PLAN);
  assert.equal(m.get(1), 'verified');
  assert.equal(m.get(2), 'search only (the paper was not opened; do not cite)');
  assert.equal(m.get(3), 'verified (abstract only; do not cite a finding from it)');
  assert.equal(m.get(4), 'verified (read in full)');
});

// TC7: checkAbstract
test('TC7 checkAbstract gives FAIL for an abstract macro that Chapter 6 does not use', () => {
  const abs = [{ name: 'eOneAValue', line: 3 }, { name: 'eTwoOnlyInAbstract', line: 5 }];
  const r = checkAbstract(abs, new Set(['eOneAValue', 'eFiveOther']), 'chapters/abstract.tex');
  assert.equal(r.status, 'FAIL');
  const f = levels(r.findings, 'FAIL');
  assert.equal(f.length, 1);
  assert.deepEqual([f[0].path, f[0].line], ['chapters/abstract.tex', 5]);
  assert.match(f[0].message, /eTwoOnlyInAbstract/);
});

test('TC7 checkAbstract passes when every abstract macro is in Chapter 6', () => {
  const r = checkAbstract([{ name: 'eOneAValue', line: 3 }, { name: 'eOneAValue', line: 4 }], new Set(['eOneAValue']), 'abs.tex');
  assert.equal(r.status, 'PASS');
  assert.deepEqual(r.findings, []);
  assert.match(r.summary, /1 /);
});

// TC8: words, overlaps, inQuote, checkOverlap
const RUN8 = 'alpha bravo charlie delta echo foxtrot golf hotel';
const RUN16 = `${RUN8} india juliet kilo lima mike november oscar papa`;

test('TC8 words lowercases, drops LaTeX commands and URLs, and keeps the line of each word', () => {
  const w = words(['\\textbf{Alpha} bravo, \\emph{charlie}\\% \\url{http://x.org/a-b}', 'Delta_echo 12 \\\\'], 'tex');
  assert.deepEqual(w.map((x) => x.w), ['alpha', 'bravo', 'charlie', 'delta', 'echo', '12']);
  assert.deepEqual(w.map((x) => x.line), [1, 1, 1, 2, 2, 2]);
});

test('TC8 words reads Markdown: no markup characters, no link URLs', () => {
  const w = words(['# Alpha *bravo* [link](http://x.org/a-b) `code` | cell', 'see https://y.org/z now'], 'md');
  assert.deepEqual(w.map((x) => x.w), ['alpha', 'bravo', 'link', 'code', 'cell', 'see', 'now']);
});

test('TC8 overlaps finds an 8-word run with both lines, and nothing for a 7-word run', () => {
  const thesis = words([`Intro one two three. ${RUN8} then more words`], 'tex');
  const source = words(['xx yy', `zz ${RUN8} ww`], 'tex');
  const m = overlaps(thesis, source, 8);
  assert.equal(m.length, 1);
  assert.deepEqual([m[0].thesisLine, m[0].sourceLine, m[0].length], [1, 2, 8]);
  assert.equal(m[0].text, RUN8);
  const short = words(['zz alpha bravo charlie delta echo foxtrot golf ww'], 'tex');
  assert.deepEqual(overlaps(thesis, short, 8), []);
});

test('TC8 overlaps merges touching runs into one match and caps the text at 12 words', () => {
  const thesis = words([RUN16], 'tex');
  const source = words([RUN8, 'other words in between', 'india juliet kilo lima mike november oscar papa'], 'tex');
  const m = overlaps(thesis, source, 8);
  assert.equal(m.length, 1);
  assert.equal(m[0].length, 16);
  assert.equal(m[0].sourceLine, 1);
  assert.equal(m[0].text, 'alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima');
});

test('TC8 overlaps keeps two separate runs apart', () => {
  const thesis = words([`${RUN8} one two three four five six seven eight nine ten ${RUN8.split(' ').reverse().join(' ')}`], 'tex');
  const source = words([RUN8, RUN8.split(' ').reverse().join(' ')], 'tex');
  assert.equal(overlaps(thesis, source, 8).length, 2);
});

test('TC8 inQuote is true inside a quotation with a refcite within 200 characters after it', () => {
  const text = "x ``quoted words here'' \\refcite{k} y";
  assert.equal(inQuote(text, text.indexOf('words')), true);
  assert.equal(inQuote(text, 0), false);
  assert.equal(inQuote(text, text.indexOf(' y')), false);
  const far = `x \`\`quoted words here'' ${'z'.repeat(250)} \\refcite{k}`;
  assert.equal(inQuote(far, far.indexOf('words')), false);
  assert.equal(inQuote("x ``quoted words here'' and no cite", 8), false);
});

const sourceOf = (path, group, text) => ({ path, group, kind: 'md', text });

test('TC8 checkOverlap gives WARN for the pre-thesis text, with both places', () => {
  const thesis = [{ path: 'chapters/a.tex', text: `First line.\nSecond ${RUN8} line.` }];
  const r = checkOverlap(thesis, [sourceOf('docs/Pre-thesis/x.md', 'pre-thesis', `intro\nmore\n${RUN8}`)], 8);
  assert.equal(r.status, 'WARN');
  assert.equal(r.findings.length, 1);
  const f = r.findings[0];
  assert.deepEqual([f.level, f.path, f.line], ['WARN', 'chapters/a.tex', 2]);
  assert.match(f.message, /docs\/Pre-thesis\/x\.md:3/);
  assert.match(f.message, /8 words/);
});

test('TC8 checkOverlap gives FAIL for an extract, and INFO when it is a quotation followed by a refcite', () => {
  const src = [sourceOf('.docs/e/01.md', 'extract', `Quote: ${RUN8}`)];
  const bare = checkOverlap([{ path: 'chapters/a.tex', text: `We say ${RUN8} in our text.` }], src, 8);
  assert.equal(bare.status, 'FAIL');
  assert.equal(bare.findings[0].level, 'FAIL');
  const quoted = checkOverlap([{ path: 'chapters/a.tex', text: `They write \`\`${RUN8}'' \\refcite{k} and we agree.` }], src, 8);
  assert.equal(quoted.status, 'PASS');
  assert.equal(quoted.findings[0].level, 'INFO');
});

test('TC8 checkOverlap counts matches per chapter and source group, and passes with no match', () => {
  const thesis = [
    { path: 'chapters/a.tex', text: `${RUN8} here` },
    { path: 'chapters/b.tex', text: 'nothing in common with anything at all in this line' },
  ];
  const r = checkOverlap(thesis, [sourceOf('p.md', 'pre-thesis', RUN8)], 8);
  assert.equal(r.table.length, 2);
  assert.match(r.table[0], /chapters\/a\.tex.*pre-thesis 1 match/);
  assert.match(r.table[1], /chapters\/b\.tex.*pre-thesis 0 match/);
  const none = checkOverlap([thesis[1]], [sourceOf('p.md', 'pre-thesis', RUN8)], 8);
  assert.equal(none.status, 'PASS');
});

// Task p10-overlap-quotes-only: an extract source of kind 'md-quotes' is read only inside its "..." pairs.
const extractOf = (path, text, kind = 'md-quotes') => ({ path, group: 'extract', kind, text });
const quoteOf = (...runs) => runs.map((r) => `"${r}"`).join(' ');

test('quotes-only TC1 quotePieces gives one piece per quote with its real line, and none for an unclosed quote', () => {
  assert.deepEqual(quotePieces('a "one two" b "three"\nx\ny "four five" z'), [
    { line: 1, text: 'one two' },
    { line: 1, text: 'three' },
    { line: 3, text: 'four five' },
  ]);
  assert.deepEqual(quotePieces('say "one" then "two\nnext line'), [{ line: 1, text: 'one' }]);
  assert.deepEqual(quotePieces('a\r\nb "x y"\r\nc'), [{ line: 2, text: 'x y' }]);
  assert.deepEqual(quotePieces('no quote here\nnor here'), []);
  assert.deepEqual(quotePieces(''), []);
});

test('quotes-only TC1 sourcePieces gives one words array per quote for md-quotes and one for the whole text otherwise', () => {
  const text = `Note ${RUN8}.\nQ. "alpha bravo" and "charlie delta"`;
  const q = sourcePieces(extractOf('e.md', text));
  assert.equal(q.length, 2);
  assert.deepEqual(q[0].map((x) => [x.w, x.line]), [['alpha', 2], ['bravo', 2]]);
  assert.deepEqual(q[1].map((x) => [x.w, x.line]), [['charlie', 2], ['delta', 2]]);
  const whole = sourcePieces(extractOf('e.md', text, 'md'));
  assert.equal(whole.length, 1);
  assert.equal(whole[0].length, words(text.split('\n'), 'md').length);
  assert.deepEqual(sourcePieces(extractOf('e.md', 'no quote at all')), []);
});

test('quotes-only TC2 checkOverlap gives nothing for 8 shared words in the note text outside the quotes', () => {
  const text = ['# 01', `Says: ${RUN8} is in our note.`, 'Q1. The paper says "something else entirely".'].join('\n');
  const r = checkOverlap([{ path: 'chapters/a.tex', text: `We say ${RUN8} here.` }], [extractOf('.docs/e/01.md', text)], 8);
  assert.deepEqual(r.findings, []);
  assert.equal(r.status, 'PASS');
  const old = checkOverlap([{ path: 'chapters/a.tex', text: `We say ${RUN8} here.` }], [extractOf('.docs/e/01.md', text, 'md')], 8);
  assert.equal(old.status, 'FAIL');
});

test('quotes-only TC2 checkOverlap gives FAIL for 8 shared words inside one quote, with the real line of the extract', () => {
  const text = ['# 01', `Says: ${RUN8} is in our note.`, `Q1. The paper says "${RUN8}" and more.`].join('\n');
  const r = checkOverlap([{ path: 'chapters/a.tex', text: `First.\nWe say ${RUN8} here.` }], [extractOf('.docs/e/01.md', text)], 8);
  assert.equal(r.status, 'FAIL');
  assert.equal(r.findings.length, 1);
  assert.deepEqual([r.findings[0].level, r.findings[0].path, r.findings[0].line], ['FAIL', 'chapters/a.tex', 2]);
  assert.match(r.findings[0].message, /\.docs\/e\/01\.md:3 \[extract\]/);
});

test('quotes-only TC3 checkOverlap gives nothing for a run split over two quotes, or over a quote and the note text next to it', () => {
  const thesis = [{ path: 'chapters/a.tex', text: `We say ${RUN8} here.` }];
  const two = `Q. "alpha bravo charlie delta", "echo foxtrot golf hotel" end`;
  const quoteThenNote = 'Q. "alpha bravo charlie delta" echo foxtrot golf hotel';
  const noteThenQuote = 'Q. alpha bravo charlie delta "echo foxtrot golf hotel"';
  for (const text of [two, quoteThenNote, noteThenQuote]) {
    const r = checkOverlap(thesis, [extractOf('.docs/e/01.md', text)], 8);
    assert.deepEqual(r.findings, [], text);
    // control: read as a whole text, the same line would match, so the test is sensitive to the rule
    const whole = checkOverlap(thesis, [extractOf('.docs/e/01.md', text, 'md')], 8);
    assert.equal(whole.findings.length, 1, text);
  }
});

test('quotes-only TC4 checkOverlap gives INFO for a match inside a thesis quotation with a refcite', () => {
  const src = [extractOf('.docs/e/01.md', `Q. "${RUN8}"`)];
  const quoted = checkOverlap([{ path: 'chapters/a.tex', text: `They write \`\`${RUN8}'' \\refcite{k} and we agree.` }], src, 8);
  assert.equal(quoted.status, 'PASS');
  assert.equal(quoted.findings.length, 1);
  assert.equal(quoted.findings[0].level, 'INFO');
  assert.match(quoted.findings[0].message, /\[extract, quotation with citation\]/);
  const bare = checkOverlap([{ path: 'chapters/a.tex', text: `We say ${RUN8} in our text.` }], src, 8);
  assert.equal(bare.findings[0].level, 'FAIL');
});

test('quotes-only TC5 checkOverlap counts other files, not other quotes of the same file', () => {
  const thesis = [{ path: 'chapters/a.tex', text: `We say ${RUN8} here.` }];
  const twoFiles = checkOverlap(thesis, [extractOf('.docs/e/01.md', `Q. ${quoteOf(RUN8)}`), extractOf('.docs/e/02.md', `Q. ${quoteOf(RUN8)}`)], 8);
  assert.equal(twoFiles.findings.length, 1);
  assert.match(twoFiles.findings[0].message, /\.docs\/e\/01\.md:1 \[extract, 1 more file\]/);
  const threeFiles = checkOverlap(thesis, [extractOf('.docs/e/01.md', quoteOf(RUN8)), extractOf('.docs/e/02.md', quoteOf(RUN8)), extractOf('.docs/e/03.md', quoteOf(RUN8))], 8);
  assert.match(threeFiles.findings[0].message, /\[extract, 2 more files\]/);
  const sameFile = checkOverlap(thesis, [extractOf('.docs/e/01.md', `first\nQ. ${quoteOf(RUN8)}\nmid\nQ. ${quoteOf(RUN8)}`)], 8);
  assert.equal(sameFile.findings.length, 1);
  assert.match(sameFile.findings[0].message, /\.docs\/e\/01\.md:2 \[extract\]/);
  // the longest run of the file wins, and the other file is still counted once
  const longer = checkOverlap([{ path: 'chapters/a.tex', text: `We say ${RUN16} here.` }], [extractOf('.docs/e/01.md', `${quoteOf(RUN8)}\n${quoteOf(RUN16)}`), extractOf('.docs/e/02.md', quoteOf(RUN8))], 8);
  assert.equal(longer.findings.length, 1);
  assert.match(longer.findings[0].message, /^16 words also in \.docs\/e\/01\.md:2 \[extract, 1 more file\]/);
});

test('quotes-only TC5 the summary says quotes only for the extracts and keeps the other groups as before', () => {
  const thesis = [{ path: 'chapters/a.tex', text: 'nothing in common with anything at all in this line' }];
  const r = checkOverlap(thesis, [extractOf('.docs/e/01.md', quoteOf(RUN8)), extractOf('.docs/e/02.md', quoteOf(RUN8)), sourceOf('p.md', 'pre-thesis', RUN8)], 8);
  assert.match(r.summary, /against 2 extract md \(quotes only\), 1 pre-thesis md: /);
  const pre = checkOverlap([{ path: 'chapters/a.tex', text: `${RUN8} here` }], [sourceOf('p.md', 'pre-thesis', `Note ${RUN8}`)], 8);
  assert.equal(pre.findings[0].level, 'WARN');
});

// TC9: parsePages + checkPages
const LOG = 'text\nOutput written on main.pdf (97 pages, 2623776 bytes).\nmore';
const TOC = [
  '\\contentsline {chapter}{Abstract}{xi}{chapter*.2}%',
  '\\contentsline {chapter}{\\numberline {1}INTRODUCTION}{1}{chapter.1}%',
  '\\contentsline {chapter}{\\numberline {9}CONCLUSION \\& FUTURE WORKS}{71}{chapter.9}%',
  '\\contentsline {chapter}{References}{74}{chapter*.3}%',
  '\\contentsline {chapter}{APPENDIX}{78}{appendix*.4}%',
].join('\n');
const LIMITS = { totalMax: 120, chaptersWarn: 100 };

test('TC9 parsePages reads the total from the log and the Chapter 1 and References pages from the toc', () => {
  assert.deepEqual(parsePages(LOG, TOC), { total: 97, chapter1Page: 1, referencesPage: 74 });
  assert.deepEqual(parsePages('no line', 'no toc'), { total: null, chapter1Page: null, referencesPage: null });
});

test('TC9 checkPages passes at 97 pages with 73 pages for Chapters 1-9', () => {
  const r = checkPages(parsePages(LOG, TOC), LIMITS);
  assert.equal(r.status, 'PASS');
  assert.match(r.summary, /97 pages/);
  assert.match(r.summary, /73 pages/);
});

test('TC9 checkPages gives FAIL above the total limit', () => {
  const r = checkPages({ total: 121, chapter1Page: 1, referencesPage: 74 }, LIMITS);
  assert.equal(r.status, 'FAIL');
  assert.equal(checkPages({ total: 120, chapter1Page: 1, referencesPage: 74 }, LIMITS).status, 'PASS');
});

test('TC9 checkPages gives WARN when Chapters 1-9 are above the chapter limit', () => {
  const r = checkPages({ total: 110, chapter1Page: 1, referencesPage: 102 }, LIMITS);
  assert.equal(r.status, 'WARN');
  assert.equal(checkPages({ total: 110, chapter1Page: 1, referencesPage: 101 }, LIMITS).status, 'PASS');
});

test('TC9 checkPages gives FAIL when a number could not be read', () => {
  assert.equal(checkPages({ total: null, chapter1Page: null, referencesPage: null }, LIMITS).status, 'FAIL');
});

// TC10: formatFindings, formatReport, the source has no write call and no clock
const F = (path, line, message, level = 'FAIL', check = 'numbers') => ({ check, level, path, line, message });

test('TC10 formatFindings sorts by path, line and message, whatever the input order', () => {
  const a = [F('b.tex', 2, 'x'), F('a.tex', 10, 'y'), F('a.tex', 9, 'z'), F('a.tex', 9, 'b'), F('a.tex', 9, 'a')];
  const out1 = formatFindings(a);
  const out2 = formatFindings([...a].reverse());
  assert.equal(out1, out2);
  assert.deepEqual(out1.split('\n').map((l) => l.split(' ')[0]), ['a.tex:9:', 'a.tex:9:', 'a.tex:9:', 'a.tex:10:', 'b.tex:2:']);
  assert.match(out1.split('\n')[0], / a$/);
});

test('TC10 formatFindings prints a path without the root and no line when it is 0', () => {
  const out = formatFindings([F('/repo/chapters/a.tex', 3, 'm'), F('/repo/main.pdf', 0, 'pages')], '/repo');
  assert.equal(out.includes('/repo'), false);
  assert.match(out, /^chapters\/a\.tex:3: FAIL \[numbers\] m$/m);
  assert.match(out, /^main\.pdf: FAIL \[numbers\] pages$/m);
});

test('TC10 formatReport counts PASS, WARN and FAIL per check and is the same for any finding order', () => {
  const mk = (name, findings) => ({ name, status: statusOf(findings), summary: `${name} summary`, findings });
  const results = [
    mk('numbers (thesis)', [F('a.tex', 2, 'm1'), F('a.tex', 1, 'm2')]),
    mk('abstract', []),
    mk('overlap', [F('a.tex', 3, 'm3', 'WARN', 'overlap'), F('a.tex', 4, 'm4', 'INFO', 'overlap')]),
  ];
  const rep = formatReport(results, { header: 'thesis:check' });
  assert.match(rep, /^FAIL numbers \(thesis\): numbers \(thesis\) summary$/m);
  assert.match(rep, /^PASS abstract: abstract summary$/m);
  assert.match(rep, /^WARN overlap: overlap summary$/m);
  assert.match(rep, /Result: 1 PASS, 1 WARN, 1 FAIL/);
  const swapped = results.map((r) => ({ ...r, findings: [...r.findings].reverse() }));
  assert.equal(formatReport(swapped, { header: 'thesis:check' }), rep);
});

test('TC10 statusOf is FAIL, then WARN, then PASS (INFO does not count)', () => {
  assert.equal(statusOf([F('a', 1, 'm', 'INFO')]), 'PASS');
  assert.equal(statusOf([F('a', 1, 'm', 'INFO'), F('a', 1, 'm', 'WARN')]), 'WARN');
  assert.equal(statusOf([F('a', 1, 'm', 'WARN'), F('a', 1, 'm', 'FAIL')]), 'FAIL');
});

test('TC10 the sources of lib.mjs and check.mjs have no file write, no clock and no randomness', () => {
  // check.mjs is written in plan step 3; until then only lib.mjs is read.
  const files = ['lib.mjs', 'check.mjs'].filter((f) => existsSync(join(HERE, f)));
  assert.ok(files.includes('lib.mjs'));
  const banned = /\b(writeFile|writeFileSync|appendFile|appendFileSync|createWriteStream|mkdirSync|rmSync|unlinkSync|renameSync|Date|performance|Math\.random|localeCompare)\b/;
  for (const f of files) {
    const src = readFileSync(join(HERE, f), 'utf8');
    const hit = src.match(banned);
    assert.equal(hit, null, `${f} uses ${hit && hit[0]}`);
  }
});
