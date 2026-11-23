// Pure helpers of the thesis checks (task p10-final-checks, design "Code files", lib.mjs).
// No file access, no clock, no randomness: check.mjs reads the files and passes the text in.
// Every sort has a compare function, so one tree gives one output, byte for byte.
// Tests: node --test 'scripts/thesis-check/*.test.mjs'

/** Compare function for sort: strings by code unit, numbers by value. */
export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const finding = (check, level, path, line, message) => ({ check, level, path, line, message });

/**
 * PASS when no FAIL and no WARN; WARN when no FAIL; FAIL otherwise. INFO never changes the status.
 * @param {{ level: string }[]} findings
 * @returns {'PASS' | 'WARN' | 'FAIL'}
 */
export function statusOf(findings) {
  if (findings.some((f) => f.level === 'FAIL')) return 'FAIL';
  if (findings.some((f) => f.level === 'WARN')) return 'WARN';
  return 'PASS';
}

/** One check result: `{ name, status, summary, findings, ...extra }`. */
function makeResult(name, summary, findings, extra = {}) {
  return { name, status: statusOf(findings), summary, findings, ...extra };
}

// ---------- stripTex ----------

function cutComment(line) {
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '\\') {
      i++; // an escaped character: \% is not a comment
      continue;
    }
    if (c === '%') return line.slice(0, i);
  }
  return line;
}

/**
 * The lines of a LaTeX text without `%` comments (an escaped `\%` stays). Same number of lines as the input.
 * @param {string} text
 * @returns {string[]}
 */
export function stripComments(text) {
  return text.split(/\r?\n/).map(cutComment);
}

// Commands whose first argument is a name, a file or a URL, never text a reader counts.
const BLANK_RE = /\\(url|path|href|label|ref|eqref|pageref|autoref|cref|Cref|refcite|cite|input|includegraphics|thesisdiagram)(?![A-Za-z])(\s*\[[^\]\n]*\])?/g;

function blankRange(chars, from, to) {
  for (let i = from; i < to; i++) if (chars[i] !== '\n') chars[i] = ' ';
}

/** The index of the `}` that closes the `{` at `open`, or -1. */
function matchBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * Replaces the arguments of url, path, href (first one), label, ref, refcite, input, includegraphics and thesisdiagram
 * with spaces. The text keeps its length and its line breaks, so offsets and line numbers stay valid.
 * @param {string} text
 * @returns {string}
 */
export function blankArgs(text) {
  const chars = text.split('');
  const re = new RegExp(BLANK_RE.source, 'g');
  let m;
  while ((m = re.exec(text)) !== null) {
    const name = m[1];
    let pos = m.index + m[0].length;
    if (m[2] && (name === 'includegraphics' || name === 'thesisdiagram')) blankRange(chars, pos - m[2].length, pos);
    const nargs = name === 'thesisdiagram' ? 2 : 1;
    for (let k = 0; k < nargs; k++) {
      let p = pos;
      while (p < text.length && /\s/.test(text[p])) p++;
      if (text[p] !== '{') break;
      const close = matchBrace(text, p);
      if (close < 0) break;
      blankRange(chars, p + 1, close);
      pos = close + 1;
    }
    re.lastIndex = Math.max(re.lastIndex, pos);
  }
  return chars.join('');
}

/** The body lines of a verbatim or lstlisting block become empty lines. */
function blankEnvBodies(lines) {
  const out = [];
  let inside = null;
  for (const line of lines) {
    if (inside) {
      if (line.includes(`\\end{${inside}}`)) {
        inside = null;
        out.push(line);
      } else {
        out.push('');
      }
      continue;
    }
    out.push(line);
    const m = line.match(/\\begin\{(verbatim|lstlisting)\*?\}/);
    if (m && !line.includes(`\\end{${m[1]}}`)) inside = m[1];
  }
  return out;
}

/**
 * The text a reader sees as numbers and words: no `%` comments, no arguments of url-like commands,
 * no verbatim or lstlisting body. Same number of lines as the input (line k stays line k).
 * @param {string} text
 * @returns {string[]}
 */
export function stripTex(text) {
  return blankEnvBodies(blankArgs(stripComments(text).join('\n')).split('\n'));
}

// ---------- check 1: numbers ----------

// A decimal (0.054) or a percentage (95\%). Not part of a word, of a version (15.1.6, v3.13) or of a longer number.
const NUMBER_RE = /(?<![A-Za-z0-9._])(?:\d+\.\d+|\d+(?=\\%))(?![A-Za-z0-9]|\.\d)(?:\\%)?/g;

/**
 * Typed decimals and percentages in stripped lines.
 * @param {string[]} lines
 * @param {string} file the key used in the allow-list (relative to chapters/, or slides/...)
 * @param {string} [path] the path printed in findings (default: file)
 * @returns {{ file: string, path: string, line: number, col: number, number: string, text: string }[]}
 */
export function numberCandidates(lines, file, path = file) {
  const out = [];
  lines.forEach((text, i) => {
    for (const m of text.matchAll(NUMBER_RE)) {
      out.push({ file, path, line: i + 1, col: m.index, number: m[0], text });
    }
  });
  return out;
}

/**
 * The allow-list: lines of `file<TAB>number<TAB>context<TAB>reason`. The header line, blank lines and `#` lines are skipped.
 * @param {string} tsv
 * @returns {{ file: string, number: string, context: string, reason: string, line: number }[]}
 */
export function parseAllowList(tsv) {
  const out = [];
  tsv.split(/\r?\n/).forEach((raw, i) => {
    if (raw.trim() === '' || raw.startsWith('#')) return;
    const f = raw.split('\t');
    if (f[0].trim() === 'file' && (f[1] || '').trim() === 'number') return;
    out.push({
      file: f[0].trim(),
      number: (f[1] || '').trim(),
      context: (f[2] || '').trim(),
      reason: (f[3] || '').trim(),
      line: i + 1,
    });
  });
  return out;
}

const squash = (s) => s.replace(/\s+/g, ' ');

/**
 * Removes the allowed candidates. A candidate is allowed when one entry has the same file and number and its context
 * is on the same line. An entry with no reason or no context gives FAIL and allows nothing; an entry that matches
 * nothing gives WARN.
 * @returns {{ remaining: object[], findings: object[], allowed: number }}
 */
export function applyAllowList(candidates, entries, allowPath) {
  const findings = [];
  const valid = [];
  for (const e of entries) {
    const what = `${e.file} ${e.number}`;
    if (e.reason === '') findings.push(finding('numbers', 'FAIL', allowPath, e.line, `allow-list entry has no reason (${what})`));
    else if (e.context === '') findings.push(finding('numbers', 'FAIL', allowPath, e.line, `allow-list entry has no context (${what})`));
    else valid.push(e);
  }
  const used = new Set();
  const remaining = candidates.filter((c) => {
    const text = squash(c.text);
    let allowed = false;
    valid.forEach((e, idx) => {
      if (e.file === c.file && e.number === c.number && text.includes(squash(e.context))) {
        used.add(idx);
        allowed = true;
      }
    });
    return !allowed;
  });
  valid.forEach((e, idx) => {
    if (!used.has(idx)) findings.push(finding('numbers', 'WARN', allowPath, e.line, `allow-list entry matches nothing (${e.file} ${e.number} "${e.context}")`));
  });
  return { remaining, findings, allowed: candidates.length - remaining.length };
}

const MACRO_PREFIX = /^(?:e(?:One|Two|Three|Four|Five|Six|Seven|Eight)|tune|hZero)/;

/**
 * The result macros used in stripped lines: a command whose name (the longest run of letters, as TeX reads it)
 * starts with eOne...eEight, tune or hZero.
 * @param {string[]} lines
 * @returns {{ name: string, line: number }[]}
 */
export function macroUses(lines) {
  const out = [];
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/\\([A-Za-z]+)/g)) {
      if (MACRO_PREFIX.test(m[1])) out.push({ name: m[1], line: i + 1 });
    }
  });
  return out;
}

/**
 * The names defined with newcommand or providecommand.
 * @param {string} tex
 * @returns {Set<string>}
 */
export function parseMacros(tex) {
  const names = new Set();
  for (const m of stripComments(tex).join('\n').matchAll(/\\(?:newcommand|providecommand|renewcommand)\s*\{\\([A-Za-z]+)\}/g)) names.add(m[1]);
  return names;
}

/**
 * FAIL for a result macro that is not defined, and for a use of macromissing (outside its providecommand line).
 * @param {string[]} lines stripped lines
 * @param {Set<string>} defined
 * @param {string} path
 * @returns {object[]}
 */
export function checkMacros(lines, defined, path) {
  const out = [];
  for (const u of macroUses(lines)) {
    if (!defined.has(u.name)) out.push(finding('numbers', 'FAIL', path, u.line, `\\${u.name} is not defined in results-macros.tex`));
  }
  lines.forEach((text, i) => {
    if (/\\macromissing\s*\{/.test(text) && !text.includes('\\providecommand')) {
      out.push(finding('numbers', 'FAIL', path, i + 1, '\\macromissing is used: a number has no macro yet'));
    }
  });
  return out;
}

/**
 * Check 1 on a set of files.
 * @param {{ files: { file: string, path: string, lines: string[] }[], entries: object[], defined: Set<string>, allowPath: string, name?: string }} p
 */
export function checkNumbers({ files, entries, defined, allowPath, name = 'numbers' }) {
  const cands = [];
  const macroFindings = [];
  const names = new Set();
  let uses = 0;
  for (const f of files) {
    cands.push(...numberCandidates(f.lines, f.file, f.path));
    macroFindings.push(...checkMacros(f.lines, defined, f.path));
    for (const u of macroUses(f.lines)) {
      uses++;
      names.add(u.name);
    }
  }
  const r = applyAllowList(cands, entries, allowPath);
  const typed = r.remaining.map((c) => {
    const lo = Math.max(0, c.col - 50);
    const excerpt = squash(c.text.slice(lo, c.col + c.number.length + 50)).trim();
    return finding('numbers', 'FAIL', c.path, c.line, `typed number ${c.number} has no macro and is not in the allow-list: ${excerpt}`);
  });
  const findings = [...typed, ...macroFindings, ...r.findings];
  const summary = `${cands.length} typed decimals or percentages, ${r.allowed} allowed, ${r.remaining.length} not allowed; ${uses} macro uses (${names.size} distinct), ${macroFindings.length} macro problems`;
  return makeResult(name, summary, findings);
}

// ---------- check 2: citations ----------

const ABBREV = /(?:e\.g|i\.e|et al|vs|cf|fig|eq|approx)\.$/i;
const SENTENCE_MAX = 300;

/** The sentence of the paragraph that holds the text at (line index i, column col). */
function sentenceAt(lines, i, col) {
  let a = i;
  let b = i;
  while (a > 0 && lines[a - 1].trim() !== '') a--;
  while (b < lines.length - 1 && lines[b + 1].trim() !== '') b++;
  let offset = 0;
  let len = 0;
  for (let k = a; k <= b; k++) {
    const sep = k > a ? 1 : 0;
    if (k === i) offset = len + sep + col;
    len += sep + lines[k].length;
  }
  const text = lines.slice(a, b + 1).join(' ');
  let start = 0;
  for (let p = offset; p > 1; p--) {
    if (/\s/.test(text[p - 1]) && '.?!'.includes(text[p - 2]) && !ABBREV.test(text.slice(0, p - 1))) {
      start = p;
      break;
    }
  }
  let end = text.length;
  const from = Math.max(text.indexOf('}', offset), offset);
  for (let q = from; q < text.length; q++) {
    if ('.?!'.includes(text[q]) && (q + 1 === text.length || /\s/.test(text[q + 1])) && !ABBREV.test(text.slice(0, q + 1))) {
      end = q + 1;
      break;
    }
  }
  const s = squash(text.slice(start, end)).trim();
  return s.length > SENTENCE_MAX ? `${s.slice(0, SENTENCE_MAX - 3)}...` : s;
}

/**
 * The keys of `\refcite{key}` in comment-free lines, with the line and the sentence that holds each one.
 * @param {string[]} lines
 * @returns {{ key: string, line: number, sentence: string }[]}
 */
export function refKeys(lines) {
  const out = [];
  lines.forEach((text, i) => {
    for (const m of text.matchAll(/\\refcite\{([^}]*)\}/g)) {
      out.push({ key: m[1].trim(), line: i + 1, sentence: sentenceAt(lines, i, m.index) });
    }
  });
  return out;
}

/**
 * The entries of references.tex: each `\item\label{ref:key}` line and the number n of its `% §10 [n]` comment.
 * @param {string} tex
 * @returns {{ key: string, section10: number | null, line: number }[]}
 */
export function parseReferences(tex) {
  const out = [];
  tex.split(/\r?\n/).forEach((raw, i) => {
    if (/^\s*%/.test(raw)) return;
    const m = raw.match(/^\s*\\item\\label\{ref:([^}\s]+)\}/);
    if (!m) return;
    const c = raw.match(/(?<!\\)%\s*§10\s*\[(\d+)\]\s*$/);
    out.push({ key: m[1], section10: c ? Number(c[1]) : null, line: i + 1 });
  });
  return out;
}

/**
 * The items of section 10 of the super-plan: number -> status (the text after the last " · " of the line).
 * @param {string} md
 * @returns {Map<number, string>}
 */
export function parseSection10(md) {
  const map = new Map();
  let inside = false;
  for (const line of md.split(/\r?\n/)) {
    if (/^## 10\./.test(line)) {
      inside = true;
      continue;
    }
    if (inside && /^## /.test(line)) break;
    if (!inside) continue;
    const m = line.match(/^(\d+)\. (.*)$/);
    if (!m) continue;
    const at = m[2].lastIndexOf(' · ');
    map.set(Number(m[1]), at < 0 ? '' : m[2].slice(at + 3).trim());
  }
  return map;
}

/**
 * Check 2. `uses` are `{ key, path, line, sentence }`; `refs` come from parseReferences; `section10` from parseSection10.
 * scope 'slides': an entry need not be cited, and only the used entries are checked against section 10.
 */
export function checkCitations({ uses, refs, section10, refsPath, scope = 'thesis', name = 'citations' }) {
  const findings = [];
  const defined = new Map();
  for (const r of refs) {
    if (defined.has(r.key)) findings.push(finding('citations', 'FAIL', refsPath, r.line, `entry ${r.key} is defined twice`));
    else defined.set(r.key, r);
  }
  const usedKeys = new Set(uses.map((u) => u.key));
  for (const u of uses) {
    if (!defined.has(u.key)) findings.push(finding('citations', 'FAIL', u.path, u.line, `\\refcite{${u.key}} has no entry in references.tex`));
  }
  let verified = 0;
  for (const r of refs) {
    const cited = usedKeys.has(r.key);
    if (!cited && scope !== 'slides') findings.push(finding('citations', 'FAIL', refsPath, r.line, `entry ${r.key} is never cited`));
    if (scope === 'slides' && !cited) continue;
    if (r.section10 === null) {
      findings.push(finding('citations', 'FAIL', refsPath, r.line, `entry ${r.key} has no "% §10 [n]" comment, so it is not linked to an item of section 10`));
    } else if (!section10.has(r.section10)) {
      findings.push(finding('citations', 'FAIL', refsPath, r.line, `entry ${r.key} points to §10 [${r.section10}], which is not an item of section 10`));
    } else {
      const status = section10.get(r.section10);
      if (/^verified/i.test(status)) verified++;
      else findings.push(finding('citations', 'FAIL', refsPath, r.line, `entry ${r.key} is §10 [${r.section10}] with status "${status}", not verified`));
    }
  }
  for (const u of uses) {
    const r = defined.get(u.key);
    if (!r || r.section10 === null || !section10.has(r.section10)) continue;
    if (section10.get(r.section10).includes('do not cite a finding')) {
      findings.push(finding('citations', 'INFO', u.path, u.line, `cites ${u.key} (§10 [${r.section10}], "do not cite a finding"); read the sentence: ${u.sentence}`));
    }
  }
  const summary = scope === 'slides'
    ? `${usedKeys.size} keys used on the slides, ${defined.size} defined in references.tex, ${verified} used entries verified`
    : `${usedKeys.size} keys used, ${defined.size} defined, ${verified} verified`;
  return makeResult(name, summary, findings);
}

// ---------- check 3: abstract ----------

/**
 * Every macro of the abstract must also be used in Chapter 6.
 * @param {({ name: string, line: number } | string)[]} abstractMacros
 * @param {Set<string> | string[]} chapter6Macros
 * @param {string} [path]
 * @param {string} [name]
 */
export function checkAbstract(abstractMacros, chapter6Macros, path = 'abstract.tex', name = 'abstract') {
  const ch6 = chapter6Macros instanceof Set ? chapter6Macros : new Set(chapter6Macros);
  const uses = abstractMacros.map((u) => (typeof u === 'string' ? { name: u, line: 0 } : u));
  const findings = [];
  const missing = new Set();
  for (const u of uses) {
    if (!ch6.has(u.name)) {
      missing.add(u.name);
      findings.push(finding('abstract', 'FAIL', path, u.line, `\\${u.name} is in the abstract but not in Chapter 6`));
    }
  }
  const distinct = new Set(uses.map((u) => u.name)).size;
  return makeResult(name, `${distinct} distinct macros in the abstract, ${distinct - missing.size} also in Chapter 6`, findings);
}

// ---------- check 4: overlap ----------

function plainTex(text) {
  return blankArgs(text)
    .replace(/\\[A-Za-z]+\*?/g, (m) => ' '.repeat(m.length))
    .replace(/\\[^A-Za-z\n]/g, '  ');
}

function plainMd(text) {
  return text.replace(/\]\([^)\n]*\)/g, (m) => ' '.repeat(m.length)).replace(/https?:\/\/\S+/g, (m) => ' '.repeat(m.length));
}

/**
 * Lower-case words (`[a-z0-9]+`) of a text, each with its line (1-based) and its offset in `lines.join('\n')`.
 * kind 'tex': url-like arguments and command names are dropped. kind 'md': link targets and URLs are dropped.
 * @param {string[]} lines
 * @param {'tex' | 'md'} kind
 * @returns {{ w: string, line: number, offset: number }[]}
 */
export function words(lines, kind) {
  const text = lines.join('\n');
  const plain = kind === 'md' ? plainMd(text) : plainTex(text);
  const out = [];
  let line = 1;
  let last = 0;
  for (const m of plain.matchAll(/[A-Za-z0-9]+/g)) {
    for (let i = last; i < m.index; i++) if (plain.charCodeAt(i) === 10) line++;
    last = m.index;
    out.push({ w: m[0].toLowerCase(), line, offset: m.index });
  }
  return out;
}

/**
 * The text inside each pair of straight double quotes, one piece per quote, with its real line (1-based).
 * The pairs are taken left to right on one line; a line with an odd number of '"' gives no piece for its last,
 * unclosed quote. Task p10-overlap-quotes-only: only these pieces are words of a paper in an extract file.
 * @param {string} text
 * @returns {{ line: number, text: string }[]}
 */
export function quotePieces(text) {
  const out = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const parts = raw.split('"');
    for (let k = 1; k + 1 < parts.length; k += 2) out.push({ line: i + 1, text: parts[k] });
  });
  return out;
}

/**
 * The words arrays that one source is compared with. kind 'md-quotes': one array per quote, each placed on its real
 * line, so a run of words never crosses two quotes or the note text between them. Any other kind: one array for the
 * whole text.
 * @param {{ kind: string, text: string }} source
 * @returns {{ w: string, line: number, offset: number }[][]}
 */
export function sourcePieces(source) {
  if (source.kind !== 'md-quotes') return [words(source.text.split(/\r?\n/), source.kind)];
  return quotePieces(source.text).map((q) => words([...Array(q.line - 1).fill(''), q.text], 'md'));
}

const SHINGLES = new WeakMap(); // words array -> Map(n -> keys); only a speed-up, no change of result

function shingleKeys(ws, n) {
  let byN = SHINGLES.get(ws);
  if (!byN) {
    byN = new Map();
    SHINGLES.set(ws, byN);
  }
  let keys = byN.get(n);
  if (!keys) {
    const plain = ws.map((x) => x.w);
    keys = [];
    for (let i = 0; i + n <= plain.length; i++) keys.push(plain.slice(i, i + n).join(' '));
    byN.set(n, keys);
  }
  return keys;
}

/**
 * Runs of n words or more that the thesis words share with the source words. Runs that touch or overlap are one match.
 * @param {{ w: string, line: number, offset: number }[]} thesisWords
 * @param {{ w: string, line: number, offset: number }[]} sourceWords
 * @param {number} [n]
 * @returns {{ thesisLine: number, sourceLine: number, length: number, text: string, startOffset: number, endOffset: number }[]}
 */
export function overlaps(thesisWords, sourceWords, n = 8) {
  if (thesisWords.length < n || sourceWords.length < n) return [];
  const src = new Map();
  shingleKeys(sourceWords, n).forEach((k, j) => {
    if (!src.has(k)) src.set(k, j);
  });
  const runs = [];
  shingleKeys(thesisWords, n).forEach((k, i) => {
    const j = src.get(k);
    if (j === undefined) return;
    const last = runs[runs.length - 1];
    if (last && i <= last.end) last.end = i + n;
    else runs.push({ start: i, end: i + n, src: j });
  });
  return runs.map((r) => ({
    thesisLine: thesisWords[r.start].line,
    sourceLine: sourceWords[r.src].line,
    length: r.end - r.start,
    text: thesisWords.slice(r.start, Math.min(r.end, r.start + 12)).map((x) => x.w).join(' '),
    startOffset: thesisWords[r.start].offset,
    endOffset: thesisWords[r.end - 1].offset,
  }));
}

const QUOTE_REFCITE_RANGE = 200;

/**
 * True when the offset is inside a quotation (`` ... '') that has a \refcite within 200 characters after its end.
 * @param {string} text
 * @param {number} offset
 * @returns {boolean}
 */
export function inQuote(text, offset) {
  const open = text.lastIndexOf('``', offset);
  if (open < 0) return false;
  const close = text.indexOf("''", open + 2);
  if (close < 0 || close < offset) return false;
  return /\\refcite\{/.test(text.slice(close + 2, close + 2 + QUOTE_REFCITE_RANGE));
}

const plural = (n, one, many) => (n === 1 ? one : many);

/**
 * Check 4. `thesis`: `{ path, text }` (comment-free text); `sources`: `{ path, group, kind, text }` with group
 * 'pre-thesis' (matches are WARN) or 'extract' (FAIL, or INFO inside a quotation that has a \refcite).
 * kind 'tex' and 'md' compare the whole text; kind 'md-quotes' only the text inside "..." pairs, each quote on its own.
 * One finding per match and group; the file with the longest run is named, the other files are counted.
 * `table` has one line per thesis file: matches and matched words per group.
 */
export function checkOverlap(thesis, sources, n = 8, name = 'overlap') {
  const prepared = [...sources]
    .sort((a, b) => cmp(a.path, b.path))
    .map((s) => ({ ...s, pieces: sourcePieces(s) }));
  const groups = [...new Set(sources.map((s) => s.group))].sort(cmp);
  const findings = [];
  const table = [];
  const totals = new Map(groups.map((g) => [g, { matches: 0, words: 0, fail: 0, info: 0 }]));
  for (const t of [...thesis].sort((a, b) => cmp(a.path, b.path))) {
    const lines = t.text.split(/\r?\n/);
    const text = lines.join('\n');
    const tw = words(lines, 'tex');
    const cells = [];
    for (const g of groups) {
      const byStart = new Map();
      for (const s of prepared) {
        if (s.group !== g) continue;
        // the longest match per start offset inside this file (its first piece wins a tie), then one match per file
        const inFile = new Map();
        for (const piece of s.pieces) {
          for (const m of overlaps(tw, piece, n)) {
            const best = inFile.get(m.startOffset);
            if (!best || m.length > best.length) inFile.set(m.startOffset, m);
          }
        }
        for (const m of inFile.values()) {
          const cur = byStart.get(m.startOffset);
          if (!cur) byStart.set(m.startOffset, { m, s, others: 0 });
          else if (m.length > cur.m.length) byStart.set(m.startOffset, { m, s, others: cur.others + 1 });
          else cur.others++;
        }
      }
      let matches = 0;
      let matched = 0;
      for (const start of [...byStart.keys()].sort(cmp)) {
        const { m, s, others } = byStart.get(start);
        const quoted = g === 'extract' && inQuote(text, m.startOffset) && inQuote(text, m.endOffset);
        const level = g === 'extract' ? (quoted ? 'INFO' : 'FAIL') : 'WARN';
        const tag = quoted ? `${g}, quotation with citation` : g;
        const more = others > 0 ? `, ${others} more ${plural(others, 'file', 'files')}` : '';
        findings.push(finding('overlap', level, t.path, m.thesisLine, `${m.length} words also in ${s.path}:${m.sourceLine} [${tag}${more}]: ${m.text}`));
        matches++;
        matched += m.length;
        const tot = totals.get(g);
        tot.matches++;
        tot.words += m.length;
        if (level === 'FAIL') tot.fail++;
        if (level === 'INFO') tot.info++;
      }
      cells.push(`${g} ${matches} ${plural(matches, 'match', 'matches')} (${matched} words)`);
    }
    table.push(`${t.path}: ${cells.join('; ')}`);
  }
  const kinds = new Map();
  for (const s of sources) {
    const key = `${s.group} ${s.kind === 'md-quotes' ? 'md (quotes only)' : s.kind}`;
    kinds.set(key, (kinds.get(key) || 0) + 1);
  }
  const read = [...kinds.keys()].sort(cmp).map((k) => `${kinds.get(k)} ${k}`).join(', ');
  const parts = groups.map((g) => {
    const tot = totals.get(g);
    const extra = g === 'extract' ? `, ${tot.fail} FAIL, ${tot.info} INFO` : '';
    return `${g} ${tot.matches} ${plural(tot.matches, 'match', 'matches')} (${tot.words} words${extra})`;
  });
  const summary = `${n}-word runs in ${thesis.length} thesis files against ${read || 'no sources'}: ${parts.join('; ') || 'nothing to compare'}`;
  return makeResult(name, summary, findings, { table });
}

// ---------- check 5: pages ----------

/**
 * The total pages from main.log and the pages of Chapter 1 and of References from main.toc (null when not found).
 * @param {string} log
 * @param {string} toc
 * @returns {{ total: number | null, chapter1Page: number | null, referencesPage: number | null }}
 */
export function parsePages(log, toc) {
  const all = [...log.matchAll(/Output written on \S+ \((\d+) pages?/g)];
  const c1 = toc.match(/\\contentsline \{chapter\}\{\\numberline \{1\}[^}]*\}\{(\d+)\}/);
  const rf = toc.match(/\\contentsline \{chapter\}\{References\}\{(\d+)\}/);
  return {
    total: all.length ? Number(all[all.length - 1][1]) : null,
    chapter1Page: c1 ? Number(c1[1]) : null,
    referencesPage: rf ? Number(rf[1]) : null,
  };
}

/**
 * Check 5: FAIL above limits.totalMax pages in total; WARN when Chapters 1-9 (References page minus Chapter 1 page)
 * take more than limits.chaptersWarn pages.
 * @param {{ total: number | null, chapter1Page: number | null, referencesPage: number | null }} pages
 * @param {{ totalMax: number, chaptersWarn: number }} limits
 * @param {string} [path]
 * @param {string} [name]
 */
export function checkPages(pages, limits, path = 'main.pdf', name = 'pages') {
  const findings = [];
  if (pages.total === null || pages.chapter1Page === null || pages.referencesPage === null) {
    findings.push(finding('pages', 'FAIL', path, 0, 'could not read the page numbers from main.log and main.toc'));
    return makeResult(name, 'page numbers not found', findings);
  }
  const chapters = pages.referencesPage - pages.chapter1Page;
  if (pages.total > limits.totalMax) findings.push(finding('pages', 'FAIL', path, 0, `${pages.total} pages in total, above the limit of ${limits.totalMax}`));
  if (chapters > limits.chaptersWarn) findings.push(finding('pages', 'WARN', path, 0, `Chapters 1-9 take ${chapters} pages, above ${limits.chaptersWarn}`));
  const summary = `${pages.total} pages in total (FAIL above ${limits.totalMax}); Chapters 1-9 take ${chapters} pages (WARN above ${limits.chaptersWarn})`;
  return makeResult(name, summary, findings);
}

// ---------- output ----------

/**
 * One line per finding, `path:line: LEVEL [check] message`, sorted by path, line, message. A path under `root`
 * is printed relative to it. A line of 0 is not printed.
 * @param {{ check: string, level: string, path: string, line: number, message: string }[]} findings
 * @param {string} [root]
 * @returns {string}
 */
export function formatFindings(findings, root = '') {
  const base = root.replace(/\/+$/, '');
  const rel = (p) => (base && p.startsWith(`${base}/`) ? p.slice(base.length + 1) : p);
  return [...findings]
    .sort((a, b) => cmp(rel(a.path), rel(b.path)) || cmp(a.line || 0, b.line || 0) || cmp(a.message, b.message) || cmp(a.level, b.level))
    .map((f) => `${rel(f.path)}${f.line ? `:${f.line}` : ''}: ${f.level} [${f.check}] ${f.message}`)
    .join('\n');
}

/**
 * The whole report: one line per check, the per-chapter tables, the findings and the PASS, WARN and FAIL counts.
 * @param {{ name: string, status: string, summary: string, findings: object[], table?: string[] }[]} results
 * @param {{ root?: string, header?: string }} [opts]
 * @returns {string}
 */
export function formatReport(results, { root = '', header = '' } = {}) {
  const out = [];
  if (header) out.push(header, '');
  for (const r of results) out.push(`${r.status} ${r.name}: ${r.summary}`);
  for (const r of results) {
    if (r.table && r.table.length) out.push('', `${r.name}, per chapter:`, ...r.table.map((l) => `  ${l}`));
  }
  const all = results.flatMap((r) => r.findings);
  const count = (level) => all.filter((f) => f.level === level).length;
  out.push('');
  if (all.length === 0) out.push('Findings: none');
  else out.push(`Findings: ${count('FAIL')} FAIL, ${count('WARN')} WARN, ${count('INFO')} INFO`, formatFindings(all, root));
  const n = (s) => results.filter((r) => r.status === s).length;
  out.push('', `Result: ${n('PASS')} PASS, ${n('WARN')} WARN, ${n('FAIL')} FAIL`);
  return out.join('\n');
}
