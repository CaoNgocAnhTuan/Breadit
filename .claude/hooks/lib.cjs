'use strict';
/**
 * Shared code for the Breadit harness: the hooks in this folder and the task CLI (task.cjs).
 * Node built-ins only. A hook reads one JSON object on stdin (the Claude Code hook input)
 * and prints at most one JSON object on stdout.
 *
 * The author's workflow: /task or /bugfix writes Spec + Impact in design.md → /approve →
 * Design section of design.md → /approve → plan.md → /approve → Sonnet implements, Opus verifies.
 * Each task is one folder in .docs/works/ with two files: design.md and plan.md.
 * State lives in status lines: "Spec status:" and "Design status:" in design.md, "Status:" in plan.md.
 * Only the author's /approve (hook on-prompt.cjs) writes "approved".
 */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HARNESS_OFF = process.env.BREADIT_HARNESS === 'off';
const TEMPLATES = path.join(__dirname, '..', 'templates');
const WORKS = '.docs/works';
const STAGES = ['spec', 'design', 'plan'];
const TASK_TYPES = ['feature', 'bug'];
const LINE_LIMITS = { design: 800, plan: 600 };

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

const TASK_FILE_RE = /^\.docs\/works\/([^/]+)\/(design|plan)\.md$/;

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

/** The label of each status line, and the file it lives in. */
const STATUS_LABEL = { spec: 'Spec status', design: 'Design status', plan: 'Status' };
const STATUS_FILE = { spec: 'design', design: 'design', plan: 'plan' };
const ANY_STATUS_LINE_RE = /^(?:Spec status|Design status|Status):.*$/gm;

/** Matches a status line that says "approved". Only the author's /approve may write one. */
const APPROVED_LINE_RE = /^(?:Spec status|Design status|Status):[ \t]*approved\b/im;

const statusRe = (stage) => new RegExp(`^${STATUS_LABEL[stage]}:[ \\t]*([A-Za-z]+)`, 'm');

/** The status word of a stage ("draft", "approved", ...), or null if the line is missing. */
function statusOf(stage, text) {
  const m = statusRe(stage).exec(text || '');
  return m ? m[1].toLowerCase() : null;
}

/** Replace the status line of a stage. Returns null if the text has none. */
function setStatus(stage, text, status, date) {
  const re = new RegExp(`^${STATUS_LABEL[stage]}:.*$`, 'm');
  if (!re.test(text)) return null;
  return text.replace(re, `${STATUS_LABEL[stage]}: ${status} · ${date}`);
}

/** A header field such as "Type: bug · Bug ID: T6". */
function field(text, name) {
  const m = new RegExp(`(?:^|·)[ \\t]*${name}:[ \\t]*([A-Za-z][\\w-]*)`, 'mi').exec(text || '');
  return m ? m[1].toLowerCase() : null;
}

const taskDir = (folder) => path.join(projectDir(), WORKS, folder);

/**
 * One task folder, or null. Folders from before the two-file workflow (no "Spec status:" line
 * in design.md) are old records and are ignored.
 */
function loadTask(folder) {
  if (!folder) return null;
  const dir = taskDir(folder);
  let designText;
  try {
    if (!fs.statSync(dir).isDirectory()) return null;
    designText = fs.readFileSync(path.join(dir, 'design.md'), 'utf8');
  } catch {
    return null;
  }
  if (!statusOf('spec', designText)) return null;
  const planFile = path.join(dir, 'plan.md');
  const planText = fs.existsSync(planFile) ? fs.readFileSync(planFile, 'utf8') : null;
  const type = field(designText, 'Type');
  return {
    folder,
    dir,
    designFile: path.join(dir, 'design.md'),
    planFile,
    designText,
    planText,
    type: TASK_TYPES.includes(type) ? type : 'feature',
    status: {
      spec: statusOf('spec', designText),
      design: statusOf('design', designText) || 'pending',
      plan: planText === null ? 'none' : statusOf('plan', planText) || 'draft',
    },
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
  return names.sort().map(loadTask).filter(Boolean);
}

/** True while code may be edited: the plan is approved and the task is not done. */
const canImplement = (task) => Boolean(task) && task.status.plan === 'approved';

function nextStep(text) {
  const m = /^[ \t]*[-*][ \t]+\[ \][ \t]+(.+)$/m.exec(text || '');
  return m ? m[1].trim().slice(0, 160) : null;
}

const statusLine = (task) => `spec ${task.status.spec} · design ${task.status.design} · plan ${task.status.plan}`;

/** Where the task stands and what comes next. */
function describe(task) {
  const s = task.status;
  if (s.spec !== 'approved') return { stage: 'spec draft', next: 'the author reviews Spec and Impact in design.md and types /approve' };
  if (s.design === 'pending') return { stage: 'spec approved', next: 'Claude writes the Design section of design.md' };
  if (s.design !== 'approved') return { stage: 'design draft', next: 'the author reviews the Design section and types /approve' };
  if (s.plan === 'none') return { stage: 'design approved', next: 'Claude writes plan.md' };
  if (s.plan === 'done') return { stage: 'done', next: null };
  if (s.plan !== 'approved') return { stage: 'plan draft', next: 'the author reviews plan.md and types /approve' };
  return {
    stage: 'implementing',
    next: nextStep(task.planText) || 'fill Result in plan.md, then `node .claude/hooks/task.cjs done`',
  };
}

// ---------------------------------------------------------------- templates

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, name), 'utf8');
}

function fillTemplate(name, values) {
  return readTemplate(name).replace(/\{\{([A-Z_]+)\}\}/g, (m, key) => (key in values ? values[key] : m));
}

// ---------------------------------------------------------------- determinism (super-plan §2)

const DETERMINISM_SCOPE_RE = /^(eval\/|packages\/ranking\/|apps\/backend\/src\/ranking\/)/;
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
  LINE_LIMITS,
  STATUS_FILE,
  TASK_FILE_RE,
  APPROVED_LINE_RE,
  ANY_STATUS_LINE_RE,
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
  readTemplate,
  fillTemplate,
  determinismFindings,
};
