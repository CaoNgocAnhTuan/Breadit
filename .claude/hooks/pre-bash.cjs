#!/usr/bin/env node
'use strict';
/**
 * PreToolUse hook for Bash.
 *
 * It reads the command roughly: heredoc bodies and quoted strings are set aside first, so a
 * commit message that mentions "db push" is not mistaken for the command. Then:
 *   deny  - wiping data, skipping migrations, reading .env, force push, faking an approval,
 *           committing off test-app, shell writes into protected paths;
 *   ask   - push, tags, branches, anything on main, throwing away work, --no-verify,
 *           the eval test split, shell writes into code while no plan is approved;
 *   allow - a plain `git add` / `git commit` while the active task's plan is approved
 *           (approving a plan also approves the commits it lists).
 * This is a seat belt, not a sandbox: a command written to get past it can.
 */
const h = require('./lib.cjs');

const input = h.readInput();
if (h.HARNESS_OFF) h.done();
const raw = String((input.tool_input || {}).command || '');
if (!raw.trim()) h.done();
const cwd = input.cwd || h.projectDir();
const cmd = parse(raw);

const NEVER = [
  [/\bprisma\b[^\n;&|]*\bdb\s+push\b/, '`prisma db push` skips migrations, and Docker deploys with `migrate deploy`. Make a real migration (CLAUDE.md)'],
  [/\bdev:reset\b/, '`dev:reset` runs `prisma db push --force-reset`, which wipes the database and skips the migrations'],
  [/\bprisma\b[^\n;&|]*\bmigrate\s+reset\b/, '`prisma migrate reset` wipes the database'],
  [/\bdocker(?:-compose|\s+compose)\b[^\n;&|]*\bdown\b[^\n;&|]*\s(?:-v|--volumes)\b/, '`down -v` deletes the Postgres volume and the dev data in it'],
  [/\bdocker\s+(?:volume\s+(?:rm|prune)|system\s+prune)\b/, 'this deletes Docker volumes and the dev data in them'],
  [/\bgit\s+push\b[^\n;&|]*\s(?:-f|--force|--force-with-lease)\b/, 'force push rewrites shared history'],
  [/hooks\/on-prompt\.cjs/, 'only the author approves, by typing /approve'],
];
for (const [re, why] of NEVER) if (re.test(cmd.bare)) h.deny(`${why}.`);

const WRITE_HINT = /(?:^|[^=\-<>])>>?|\btee\b|\bsed\b[^\n;&|]*\s-i|\bperl\b[^\n;&|]*\s-i|writeFile|appendFile/;
if (/Status:[ \t]*approved/i.test(cmd.noHeredoc) && WRITE_HINT.test(cmd.noHeredoc)) {
  h.deny('only the author approves, by typing /approve. Claude never writes "Status: approved".');
}

for (const seg of cmd.segments) {
  if (seg.tokens.some((t) => /(^|\/)\.env(\.(local|development|production|test)(\.local)?)?$/.test(t))) {
    h.deny('.env files hold live secrets (SMTP, Cloudinary). Read .env.example instead, or ask the author.');
  }
  for (const target of seg.targets) {
    const rel = h.relPath(target, cwd);
    const why = rel && h.protectedReason(rel);
    if (why) h.deny(`this command writes to ${rel}, which is protected: ${why}.`);
  }
  if (seg.verb === 'git' && seg.sub === 'commit') {
    const branch = h.currentBranch();
    if (branch && branch !== 'test-app') h.deny(`commits go on test-app only (now on ${branch}).`);
  }
}

const ASK = [
  [/\bgit\s+push\b/, "push needs the author's OK"],
  [/\bgit\s+tag\s+(?!-l\b|--list\b|-n\b)(?=\S)/, 'tags mark thesis milestones (like v1-prethesis); the author decides'],
  [/\bgit\s+(?:checkout|switch)\s+(?:-[bBcC]\b|--orphan\b)/, "all work stays on test-app; a new branch needs the author's OK"],
  [/\bgit\s+branch\s+(?:-[dDmMcCf]\b|(?!-)\S)/, "all work stays on test-app; changing branches needs the author's OK"],
  [/\bgit\s+(?:merge|rebase|reset|update-ref|push|cherry-pick)\b[^\n;&|]*\bmain\b|\bgit\s+(?:checkout|switch)\s+main\b/, 'this touches main; the author decides'],
  [/\bgit\s+reset\s+--hard\b|\bgit\s+clean\s+-\w*f|\bgit\s+stash\s+(?:drop|clear)\b|\bgit\s+(?:checkout|restore)\s+(?:--\s+)?\.(?=\s|$)/, 'this throws away uncommitted work'],
  [/\bgit\b[^\n;&|]*\bcommit\b[^\n;&|]*(?:--no-verify|\s-n\b)/, "skipping the Husky pre-commit checks needs the author's OK"],
  [/--split[=\s]+test\b/, 'the test split runs once, after the hypotheses and tuning are frozen (super-plan §5); the author must agree'],
];
for (const [re, why] of ASK) if (re.test(cmd.bare)) h.ask(`${why}.`);

for (const seg of cmd.segments) {
  if (seg.verb === 'git' && (seg.sub === 'checkout' || seg.sub === 'switch')) {
    const target = seg.args.filter((a) => !a.startsWith('-'))[1];
    if (target && target !== 'test-app' && h.isBranch(target)) {
      h.ask(`this switches to branch ${target}; all work stays on test-app.`);
    }
  }
}

const task = h.activeTask();
const implementing = h.canImplement(task);
if (!implementing) {
  for (const seg of cmd.segments) {
    for (const target of seg.targets) {
      const rel = h.relPath(target, cwd);
      if (rel && h.isGated(rel)) {
        h.ask(`this command writes to ${rel} (code or config) and no plan is approved. Allow it only if the author wants it outside the workflow.`);
      }
    }
  }
}

const plainCommit =
  cmd.segments.length > 0 &&
  cmd.segments.some((s) => s.verb === 'git' && s.sub === 'commit') &&
  cmd.segments.every((s) => s.verb === 'git' && ['add', 'commit', 'status', 'diff', 'log'].includes(s.sub));
if (plainCommit && implementing) h.allow(`commit while the plan of ${task.folder} is approved.`);
h.done();

/**
 * Splits a command into segments. Each segment has its verb, the git subcommand,
 * its arguments (quotes removed) and the files it writes to (redirects, rm, mv, cp target,
 * sed -i, tee, git checkout/restore of paths).
 */
function parse(text) {
  const noHeredoc = text.replace(/<<-?[ \t]*(['"]?)([A-Za-z_]\w*)\1[^\n]*\n[\s\S]*?\n[ \t]*\2[ \t]*(?=\n|$)/g, ' __HEREDOC__ ');
  const quoted = [];
  const bare = noHeredoc.replace(/"((?:\\.|[^"\\])*)"|'([^']*)'/g, (m, d, s) => {
    quoted.push(d !== undefined ? d : s);
    return ` __Q${quoted.length - 1}__ `;
  });
  const restore = (t) => t.replace(/__Q(\d+)__/g, (m, i) => quoted[Number(i)]);
  const parts = bare.replace(/\d*>&\d+|\d*>&-/g, ' ').split(/\|\||&&|[;|&\n]/);
  const segments = [];
  for (const part of parts) {
    if (!part.trim()) continue;
    const targets = [];
    const redirect = /(?:^|[^=\-<>])\d*>>?[ \t]*([^\s;&|()<>]+)/g;
    for (const m of part.matchAll(redirect)) targets.push(restore(m[1]));
    let tokens = part
      .replace(redirect, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(restore);
    while (tokens.length && (/^[A-Za-z_]\w*=/.test(tokens[0]) || ['sudo', 'command', 'env', 'nohup', 'time', 'exec'].includes(tokens[0]))) {
      tokens = tokens.slice(1);
    }
    const verb = tokens[0] ? tokens[0].split('/').pop() : '';
    const args = tokens.slice(1).filter((a) => a !== '');
    const plain = args.filter((a) => !a.startsWith('-'));
    let sub = '';
    if (verb === 'git') {
      for (let i = 0; i < args.length; i += 1) {
        if (args[i] === '-C' || args[i] === '-c') i += 1;
        else if (!args[i].startsWith('-')) {
          sub = args[i];
          break;
        }
      }
    }
    if (['rm', 'rmdir', 'unlink', 'truncate', 'touch', 'tee', 'mkdir', 'shred', 'mv'].includes(verb)) targets.push(...plain);
    else if (['cp', 'rsync', 'ln', 'install'].includes(verb) && plain.length > 1) targets.push(plain[plain.length - 1]);
    else if ((verb === 'sed' || verb === 'perl') && args.some((a) => /^-[a-zA-Z]*i/.test(a))) targets.push(...plain.slice(1));
    else if (verb === 'git' && (sub === 'checkout' || sub === 'restore')) {
      const dd = args.indexOf('--');
      const paths = dd >= 0 ? args.slice(dd + 1) : plain.slice(1).filter((a) => !h.isBranch(a));
      targets.push(...paths.filter((a) => !a.startsWith('-')));
    }
    segments.push({
      verb,
      sub,
      args,
      tokens: [verb, ...args],
      targets: targets.filter((t) => t && !/[$`]/.test(t) && t !== '/dev/null' && t !== '__HEREDOC__'),
    });
  }
  return { bare, noHeredoc, segments };
}
