#!/usr/bin/env node
// The final checks of the thesis (task p10-final-checks, design "Approach"). Run from the repo root with Node from
// .nvmrc (`nvm use`):
//
//   npm run thesis:check                 build the PDF with latexmk, then run the checks
//   npm run thesis:check -- --no-build   skip the build and read the last main.log and main.toc
//
// Checks on the thesis: numbers (typed decimals and percentages, undefined result macros), citations (every key defined,
// every entry cited and "verified" in super-plan section 10), abstract (its macros are in Chapter 6), overlap (runs of
// 8 words shared with the pre-thesis text and the paper extracts), pages. On the slides: numbers and citations.
// One line per check, then the findings (`path:line: LEVEL [check] message`), then the PASS, WARN and FAIL counts.
// Exit code 1 when a check FAILs. The output has no clock and no absolute path, so one tree gives one output.
//
// It reads files only (docs/Pre-thesis/ too) and prints to stdout. The only thing it runs is latexmk, whose build files
// are git-ignored. Save the output with shell redirection. The pure parts are in lib.mjs, with tests.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  checkAbstract,
  checkCitations,
  checkNumbers,
  checkOverlap,
  checkPages,
  cmp,
  formatReport,
  macroUses,
  parseAllowList,
  parseMacros,
  parsePages,
  parseReferences,
  parseSection10,
  refKeys,
  statusOf,
  stripComments,
  stripTex,
} from './lib.mjs';

// The limits of check 5. Super-plan section 11 item 2: at most 120 pages, target 80-100; implementation plan row 28 says
// "at most 100". Whether the appendix counts is a question for the supervisor (2026-11-30): change these two numbers then.
const TOTAL_PAGES_MAX = 120; // FAIL above this many pages in the whole PDF
const CHAPTER_PAGES_WARN = 100; // WARN above this many pages for Chapters 1-9
const OVERLAP_WORDS = 8; // the length of a shared run of words

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const THESIS = '.docs/Thesis-Report';
const CHAPTERS = `${THESIS}/chapters`;
const SLIDES = `${THESIS}/slides/progress-2026-11-30.tex`;
const MACROS = '.docs/results/p7-report/results-macros.tex';
const SUPER_PLAN = '.docs/super-plan.md';
const ALLOW = 'scripts/thesis-check/allow-numbers.tsv';
const PRE_THESIS = 'docs/Pre-thesis';
const PRE_THESIS_TEX = `${PRE_THESIS}/Latex/chapters`;
const EXTRACTS = '.docs/works/2026-10-23-p1-literature/extracts';
const REFERENCES = `${CHAPTERS}/references.tex`;
const ABSTRACT = `${CHAPTERS}/abstract.tex`;
const CHAPTER6 = `${CHAPTERS}/experiments-and-results.tex`;
const SLIDES_KEY = 'slides/progress-2026-11-30.tex';

const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

/** The files of a folder with the given ending, sorted by name. */
function list(relDir, ending) {
  return readdirSync(join(ROOT, relDir))
    .filter((f) => f.endsWith(ending))
    .sort(cmp);
}

/** Every file under a folder (sorted), skipping the folders named in `skip`. */
function walk(relDir, skip) {
  const out = [];
  const entries = readdirSync(join(ROOT, relDir), { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name));
  for (const e of entries) {
    const rel = `${relDir}/${e.name}`;
    if (e.isDirectory()) {
      if (!skip.has(e.name)) out.push(...walk(rel, skip));
    } else {
      out.push(rel);
    }
  }
  return out;
}

function parseArgs(argv) {
  const opts = { build: true };
  for (const a of argv) {
    if (a === '--no-build') opts.build = false;
    else throw new Error(`unknown argument: ${a} (the only option is --no-build)`);
  }
  return opts;
}

/** Runs latexmk in the thesis folder. Returns a FAIL finding when it does not exit with 0. */
function buildPdf() {
  const r = spawnSync('latexmk', ['-pdf', '-interaction=nonstopmode', 'main.tex'], {
    cwd: join(ROOT, THESIS),
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.error) return [{ check: 'pages', level: 'FAIL', path: `${THESIS}/main.tex`, line: 0, message: `latexmk did not run: ${r.error.message}` }];
  if (r.status !== 0) return [{ check: 'pages', level: 'FAIL', path: `${THESIS}/main.tex`, line: 0, message: `latexmk exited with ${r.status}; see ${THESIS}/main.log` }];
  return [];
}

function main() {
  const opts = parseArgs(process.argv.slice(2));

  const defined = parseMacros(read(MACROS));
  const chapterFiles = list(CHAPTERS, '.tex');
  const chapters = chapterFiles.map((f) => {
    const raw = read(`${CHAPTERS}/${f}`);
    return { file: f, path: `${CHAPTERS}/${f}`, raw, commentFree: stripComments(raw), stripped: stripTex(raw) };
  });
  const slidesRaw = read(SLIDES);
  const slides = { file: SLIDES_KEY, path: SLIDES, commentFree: stripComments(slidesRaw), stripped: stripTex(slidesRaw) };

  const entries = parseAllowList(read(ALLOW));
  const isSlideEntry = (e) => e.file.startsWith('slides/');

  // check 1: numbers
  const numbersThesis = checkNumbers({
    files: chapters.map((c) => ({ file: c.file, path: c.path, lines: c.stripped })),
    entries: entries.filter((e) => !isSlideEntry(e)),
    defined,
    allowPath: ALLOW,
    name: 'numbers (thesis)',
  });
  const numbersSlides = checkNumbers({
    files: [{ file: slides.file, path: slides.path, lines: slides.stripped }],
    entries: entries.filter(isSlideEntry),
    defined,
    allowPath: ALLOW,
    name: 'numbers (slides)',
  });

  // check 2: citations
  const refs = parseReferences(read(REFERENCES));
  const section10 = parseSection10(read(SUPER_PLAN));
  const usesOf = (item) => refKeys(item.commentFree).map((k) => ({ ...k, path: item.path }));
  const citationsThesis = checkCitations({
    uses: chapters.flatMap(usesOf),
    refs,
    section10,
    refsPath: REFERENCES,
    name: 'citations (thesis)',
  });
  const citationsSlides = checkCitations({
    uses: usesOf(slides),
    refs,
    section10,
    refsPath: REFERENCES,
    scope: 'slides',
    name: 'citations (slides)',
  });

  // check 3: abstract against Chapter 6
  const abstractFile = chapters.find((c) => c.path === ABSTRACT);
  const chapter6 = chapters.find((c) => c.path === CHAPTER6);
  const abstract = checkAbstract(macroUses(abstractFile.stripped), new Set(macroUses(chapter6.stripped).map((u) => u.name)), ABSTRACT);

  // check 4: overlap with the pre-thesis text and the paper extracts (read only)
  const sources = [
    ...list(PRE_THESIS_TEX, '.tex').map((f) => ({ path: `${PRE_THESIS_TEX}/${f}`, group: 'pre-thesis', kind: 'tex', text: stripComments(read(`${PRE_THESIS_TEX}/${f}`)).join('\n') })),
    ...walk(PRE_THESIS, new Set(['Latex', 'output']))
      .filter((p) => p.endsWith('.md'))
      .map((p) => ({ path: p, group: 'pre-thesis', kind: 'md', text: read(p) })),
    ...list(EXTRACTS, '.md').map((f) => ({ path: `${EXTRACTS}/${f}`, group: 'extract', kind: 'md-quotes', text: read(`${EXTRACTS}/${f}`) })),
  ];
  const overlap = checkOverlap(
    chapters.filter((c) => c.path !== REFERENCES).map((c) => ({ path: c.path, text: c.commentFree.join('\n') })),
    sources,
    OVERLAP_WORDS,
  );

  // check 5: pages
  const buildFindings = opts.build ? buildPdf() : [];
  const log = existsSync(join(ROOT, THESIS, 'main.log')) ? read(`${THESIS}/main.log`) : '';
  const toc = existsSync(join(ROOT, THESIS, 'main.toc')) ? read(`${THESIS}/main.toc`) : '';
  const pagesBase = checkPages(parsePages(log, toc), { totalMax: TOTAL_PAGES_MAX, chaptersWarn: CHAPTER_PAGES_WARN }, `${THESIS}/main.pdf`);
  const pagesFindings = [...buildFindings, ...pagesBase.findings];
  const pages = {
    ...pagesBase,
    findings: pagesFindings,
    status: statusOf(pagesFindings),
    summary: `${pagesBase.summary} (${opts.build ? 'built now' : 'from the last build'})`,
  };

  const results = [numbersThesis, citationsThesis, abstract, overlap, pages, numbersSlides, citationsSlides];
  const header = `thesis:check (${opts.build ? 'builds the PDF' : '--no-build'}; overlap run of ${OVERLAP_WORDS} words)`;
  process.stdout.write(`${formatReport(results, { root: ROOT, header })}\n`);
  process.exitCode = results.some((r) => r.status === 'FAIL') ? 1 : 0;
}

try {
  main();
} catch (err) {
  process.stderr.write(`thesis:check: ${err.message}\n`);
  process.exitCode = 2;
}
