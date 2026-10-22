'use strict';
/**
 * Shared code for the Breadit harness: the hooks in this folder and the task CLI (task.cjs).
 * Node built-ins only. A hook reads one JSON object on stdin (the Claude Code hook input)
 * and prints at most one JSON object on stdout.
 *
 * The author's workflow: spec.md → /approve → design.md → /approve → plan.md → /approve → code.
 * Each task is one folder in .docs/works/. The first "Status:" line of each file holds its state:
 * draft, approved or done. Only the author's /approve (hook on-prompt.cjs) writes "approved".
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS_OFF = process.env.BREADIT_HARNESS === 'off';
const TEMPLATES = path.join(__dirname, '..', 'templates');
const WORKS = '.docs/works';
const STAGES = ['spec', 'design', 'plan'];
const TASK_TYPES = ['feature', 'bug', 'experiment', 'writing'];

// ---------------------------------------------------------------- paths

/** realpath of the longest existing prefix, so /tmp and /private/tmp compare equal on macOS. */
function realish(p) {
  let cur = path.resolve(p);
  const rest = [];
  while (!fs.existsSync(cur)) {
    const parent = path.dirname(cur);
    if (parent === cur) break;
    rest.unshift(path.basename(cur));
    cur = parent;
  }
  try {
    cur = fs.realpathSync(cur);
  } catch {
    // keep the resolved path
  }
  return path.join(cur, ...rest);
}

let root;
function projectDir() {
  if (!root) root = realish(process.env.CLAUDE_PROJECT_DIR || process.cwd());
  return root;
}

/** Path relative to the project root with "/" separators, or null if it is outside the project. */
function relPath(file, base) {
  if (!file || typeof file !== 'string') return null;
  const abs = realish(path.resolve(base || projectDir(), file));
  const rel = path.relative(projectDir(), abs);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return rel.split(path.sep).join('/');
}

/** Why a path must never be edited, or null. Checked for Edit/Write and for shell writes. */
function protectedReason(rel) {
  if (/^(docs|Latex)(\/|$)/.test(rel)) {
    return `${rel.split('/')[0]}/ is frozen pre-thesis material. Thesis docs go in .docs/, thesis LaTeX in .docs/latex/ (CLAUDE.md)`;
  }
  if (/(^|\/)\.env(\.[^/]+)?$/.test(rel) && !/\.example$/.test(rel)) {
    return '.env files hold live secrets (SMTP, Cloudinary). Change the .env.example file instead and tell the author';
  }
  if (rel === 'datasets/humans_v1.sql') {
    return 'humans_v1 is a frozen dataset that mirrors the *_data_humans_v1* migrations';
  }
  if (rel === '.docs/results/manifest.json') {
    return 'only the repro script (`npm run thesis:repro`) writes the results manifest';
  }
  if (/^apps\/backend\/prisma\/migrations\/./.test(rel) && isTracked(rel)) {
    return 'a committed migration never changes. Create a new one with `npx prisma migrate dev --name <name> --schema=apps/backend/prisma/schema.prisma`';
  }
  return null;
}

/**
 * Code and config: everything in the project except thesis docs (.docs/, but not .docs/latex/
 * and .docs/results/), root Markdown files and the harness state folder.
 * Editing these needs an approved plan for the active task.
 */
function isGated(rel) {
  if (rel.startsWith('.docs/')) return /^\.docs\/(latex|results)\//.test(rel);
  if (rel === '.claude/state' || rel.startsWith('.claude/state/')) return false;
  if (!rel.includes('/') && /\.md$/i.test(rel)) return false;
  return true;
}

const TASK_FILE_RE = /^\.docs\/works\/([^/]+)\/(spec|design|plan)\.md$/;

// ---------------------------------------------------------------- hook output

function readInput() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/** Print one JSON object (if given) and end the hook with exit code 0. */
function done(obj) {
  if (obj) process.stdout.write(`${JSON.stringify(obj)}\n`);
  process.exit(0);
}

function preDecision(decision, reason) {
  done({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: decision,
      permissionDecisionReason: `[harness] ${reason}`,
    },
  });
}
const deny = (reason) => preDecision('deny', reason);
const ask = (reason) => preDecision('ask', reason);
const allow = (reason) => preDecision('allow', reason);

// ---------------------------------------------------------------- git and state

function git(args) {
  try {
    return execFileSync('git', args, {
      cwd: projectDir(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 4000,
    }).trim();
  } catch {
    return null;
  }
}
const currentBranch = () => git(['rev-parse', '--abbrev-ref', 'HEAD']);
const isTracked = (rel) => git(['ls-files', '--error-unmatch', '--', rel]) !== null;
const isBranch = (name) => git(['show-ref', '--verify', '--quiet', `refs/heads/${name}`]) !== null;

const stateDir = () => path.join(projectDir(), '.claude', 'state');
function readState(name) {
  try {
    return fs.readFileSync(path.join(stateDir(), name), 'utf8').trim() || null;
  } catch {
    return null;
  }
}
function writeState(name, value) {
  fs.mkdirSync(stateDir(), { recursive: true });
  fs.writeFileSync(path.join(stateDir(), name), `${value}\n`);
}
function clearState(name) {
  try {
    fs.unlinkSync(path.join(stateDir(), name));
  } catch {
    // already gone
  }
}

/** Local date as YYYY-MM-DD (task folders and status lines). */
function today() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------------------------------------------------------------- task files

const STATUS_RE = /^Status:[ \t]*([A-Za-z]+)/m;
const APPROVED_LINE_RE = /^Status:[ \t]*approved\b/im;

function statusOf(text) {
  const m = STATUS_RE.exec(text || '');
  return m ? m[1].toLowerCase() : 'missing';
}
const isApproved = (status) => status === 'approved' || status === 'done';

/** Replace the status line. Returns null if the text has none. */
function setStatus(text, status, date) {
  if (!STATUS_RE.test(text)) return null;
  return text.replace(/^Status:.*$/m, `Status: ${status} · ${date}`);
}

/** A header field such as "Type: bug · Mode: light". */
function field(text, name) {
  const m = new RegExp(`(?:^|·)[ \\t]*${name}:[ \\t]*([A-Za-z][\\w-]*)`, 'mi').exec(text || '');
  return m ? m[1].toLowerCase() : null;
}

const taskDir = (folder) => path.join(projectDir(), WORKS, folder);

function loadTask(folder) {
  if (!folder) return null;
  const dir = taskDir(folder);
  try {
    if (!fs.statSync(dir).isDirectory()) return null;
  } catch {
    return null;
  }
  const files = {};
  for (const stage of STAGES) {
    const file = path.join(dir, `${stage}.md`);
    if (fs.existsSync(file)) {
      const text = fs.readFileSync(file, 'utf8');
      files[stage] = { file, text, status: statusOf(text) };
    }
  }
  const spec = files.spec ? files.spec.text : '';
  const type = field(spec, 'Type');
  return {
    folder,
    dir,
    files,
    light: field(spec, 'Mode') === 'light',
    type: TASK_TYPES.includes(type) ? type : 'feature',
  };
}

const activeTask = () => loadTask(readState('active-task'));

function listTasks() {
  let names = [];
  try {
    names = fs.readdirSync(path.join(projectDir(), WORKS));
  } catch {
    return [];
  }
  return names
    .sort()
    .map(loadTask)
    .filter((t) => t && t.files.spec);
}

/** True while code may be edited: the plan (or a light spec) is approved and not yet done. */
function canImplement(task) {
  if (!task) return false;
  const f = task.light ? task.files.spec : task.files.plan;
  return Boolean(f) && f.status === 'approved';
}

function nextStep(text) {
  const m = /^[ \t]*[-*][ \t]+\[ \][ \t]+(.+)$/m.exec(text || '');
  return m ? m[1].trim().slice(0, 160) : null;
}

const statusLine = (task) =>
  STAGES.filter((s) => task.files[s])
    .map((s) => `${s} ${task.files[s].status}`)
    .join(' · ') + (task.light ? ' (light)' : '');

/** Where the task stands and what comes next. */
function describe(task) {
  const f = task.files;
  const st = (s) => (f[s] ? f[s].status : 'none');
  const waiting = (s) => `the author reviews ${s}.md and types /approve`;
  if (!f.spec) return { stage: 'new', next: 'write spec.md' };
  if (!isApproved(st('spec'))) return { stage: 'spec draft', next: waiting('spec') };
  if (task.light) {
    if (st('spec') === 'done') return { stage: 'done', next: null };
    return { stage: 'implementing (light)', next: nextStep(f.spec.text) || 'fill Result, then `node .claude/hooks/task.cjs done`' };
  }
  if (!f.design) return { stage: 'spec approved', next: '/design' };
  if (!isApproved(st('design'))) return { stage: 'design draft', next: waiting('design') };
  if (!f.plan) return { stage: 'design approved', next: '/plan' };
  if (st('plan') === 'done') return { stage: 'done', next: null };
  if (st('plan') !== 'approved') return { stage: 'plan draft', next: waiting('plan') };
  return { stage: 'implementing', next: nextStep(f.plan.text) || 'fill Result, then `node .claude/hooks/task.cjs done`' };
}

// ---------------------------------------------------------------- templates

function templateFor(stage, task) {
  if (stage === 'spec') return task && task.light ? 'spec-light.md' : `spec-${task ? task.type : 'feature'}.md`;
  if (stage === 'design') return task && task.type === 'writing' ? 'design-writing.md' : 'design.md';
  return 'plan.md';
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), 'utf8');
}

function fillTemplate(name, values) {
  return readTemplate(name).replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => (key in values ? values[key] : m));
}

const firstWord = (heading) =>
  heading
    .replace(/^\d+\.\s*/, '')
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean)[0] || '';

/** `##` sections of the stage's template that the text does not have (matched by first word). */
function missingSections(stage, task, text) {
  let tpl;
  try {
    tpl = readTemplate(templateFor(stage, task));
  } catch {
    return [];
  }
  const want = [...tpl.matchAll(/^##[ \t]+(.+?)[ \t]*$/gm)].map((m) => m[1].replace(/^\d+\.\s*/, ''));
  const have = new Set([...(text || '').matchAll(/^#{2,3}[ \t]+(.+?)[ \t]*$/gm)].map((m) => firstWord(m[1])));
  return want.filter((w) => !have.has(firstWord(w)));
}

// ---------------------------------------------------------------- determinism (super-plan §2)

const DETERMINISM_SCOPE_RE = /^(eval\/|apps\/backend\/src\/ranking\/)/;
const CODE_EXT_RE = /\.[cm]?[jt]sx?$/;
const TEST_FILE_RE = /[.-](spec|test)\.[cm]?[jt]sx?$|\/__tests__\//;

const DETERMINISM_PATTERNS = [
  [/\bDate\.now\s*\(/, 'Date.now() reads the wall clock. Take `asOf` as an argument'],
  [/\bnew\s+Date\s*\(\s*\)/, 'new Date() with no argument reads the wall clock. Take `asOf` as an argument'],
  [/\bperformance\.now\s*\(|\bprocess\.hrtime\b/, 'timers give Class R numbers; they do not belong in Class D code'],
  [/\bMath\.random\s*\(/, 'Math.random() is not seeded. Use rng(masterSeed, stageName)'],
  [/\b(randomUUID|randomBytes|randomInt|getRandomValues)\s*\(|\bcuid\s*\(/, 'random IDs change on every run. Use explicit IDs'],
  [/\.sort\s*\(\s*\)/, '.sort() with no compare function sorts as strings. Pass a total order, e.g. (scoreFixed desc, postId desc)'],
  [/\blocaleCompare\s*\(|\btoLocale(String|DateString|TimeString)\s*\(|\bIntl\./, 'locale functions depend on the machine. Compare code points and format numbers yourself'],
];

function determinismFindings(text) {
  const out = [];
  (text || '').split('\n').forEach((line, i) => {
    if (/harness-allow:/.test(line)) return;
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
    const code = line.replace(/\/\/.*$/, '');
    for (const [re, why] of DETERMINISM_PATTERNS) {
      if (re.test(code)) out.push({ line: i + 1, why });
    }
  });
  return out.slice(0, 20);
}

module.exports = {
  HARNESS_OFF,
  TEMPLATES,
  WORKS,
  STAGES,
  TASK_TYPES,
  TASK_FILE_RE,
  APPROVED_LINE_RE,
  DETERMINISM_SCOPE_RE,
  CODE_EXT_RE,
  TEST_FILE_RE,
  projectDir,
  relPath,
  protectedReason,
  isGated,
  readInput,
  done,
  deny,
  ask,
  allow,
  git,
  currentBranch,
  isTracked,
  isBranch,
  readState,
  writeState,
  clearState,
  today,
  statusOf,
  isApproved,
  setStatus,
  field,
  taskDir,
  loadTask,
  activeTask,
  listTasks,
  canImplement,
  nextStep,
  statusLine,
  describe,
  templateFor,
  readTemplate,
  fillTemplate,
  missingSections,
  determinismFindings,
};
