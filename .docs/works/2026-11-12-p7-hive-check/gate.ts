import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex, writeTable } from "../../../eval/src/canonical/csv.ts";
import type { FileEntry } from "../../../eval/src/canonical/csv.ts";
import { loadDataset } from "../../../eval/src/canonical/dataset.ts";
import type { Dataset } from "../../../eval/src/canonical/dataset.ts";
import { writeManifest } from "../../../eval/src/canonical/manifest.ts";
import type { Manifest } from "../../../eval/src/canonical/manifest.ts";
import { SCHEMAS, TABLES } from "../../../eval/src/canonical/schema.ts";
import {
  BUCKETS_0_4,
  KEPT_THRESHOLD,
  bucketOf,
  bucketReport,
  buildIndex,
  earlierEvents,
  inPool,
  testItems,
} from "../../../eval/src/checks/buckets.ts";
import type { BucketReport, BucketRow, Event } from "../../../eval/src/checks/buckets.ts";
import { checkFormat } from "../../../eval/src/checks/format.ts";
import type { FormatResult, Problem } from "../../../eval/src/checks/format.ts";
import { checkNode, loadFrozen } from "../../../eval/src/frozen.ts";
import { HIVE_TABLES, hiveCountsTable, parseHiveCsv, toHiveCanonical } from "./hive-transform.ts";
import type { HiveCounts, HiveRaw, HiveTable } from "./hive-transform.ts";

// The gate of task p7-hive-check (design: Approach, "The gate reuses the eval code; it does not copy it").
//
// It reads the raw Hive files named in sources.json (checking each SHA-256 and row count first), runs the Hive
// transform, writes the six canonical tables to a scratch folder OUTSIDE the repo, checks them with checkFormat,
// loads them with loadDataset and runs bucketReport with the frozen q, W and N_max. The gate number is the count of
// kept test users in bucket 0-4 with a community join strictly before their test time. The pool and the buckets
// are never computed here: this file calls testItems, earlierEvents, buildIndex, inPool and bucketOf of eval.
//
// Usage: node gate.ts <rawDir> <scratchDir> [--out <gate.md>] [--sources <sources.json>]
//   rawDir      the folder with the raw CSV files (datasets/raw/hive/, git-ignored)
//   scratchDir  a folder outside the repo for the canonical tables; <scratchDir>/<datasetId>/ is emptied first
//   --out       where to write gate.md (default: gate.md next to this file)
//   --sources   the sources file (default: sources.json next to this file)
// Exit code 0 when gate.md was written (pass or fail is in the file), 1 on an error (nothing is written).
//
// sources.json, the shape (one entry per raw file; the files of a table may be split by month):
//   {
//     "version": 1,
//     "datasetId": "hive-2021q1",
//     "communities": ["hive-167922", ...],            the slice, from Q1
//     "files": [
//       { "file": "votes-2021-01.csv",                name in rawDir, no folder
//         "table": "votes",                           posts | votes | replies | reblogs | subscribes | follows
//         "query": "queries/q3.sql",                  the query that made it, relative to the task folder
//         "querySha256": "<64 hex>",                  SHA-256 of that query file
//         "date": "2026-11-13",                       the day it was run (YYYY-MM-DD)
//         "bytesProcessed": 123456789,                bytes the dry run reported
//         "rows": 1000,                               data rows, header not counted
//         "sha256": "<64 hex>" }                      SHA-256 of the file as saved
//     ]
//   }

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "..", "..", "..");
const DEFAULT_SOURCES = join(HERE, "sources.json");
const DEFAULT_OUT = join(HERE, "gate.md");
const DAY = 86400;
/** Design F9: a like this soon after its post may be a bot. Reported, never filtered (Spec Open question 5). */
const BOT_WINDOW_SECONDS = 300;

function byteCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------- sources.json

export interface SourceFile {
  file: string;
  table: HiveTable;
  query: string;
  querySha256: string;
  date: string;
  bytesProcessed: number;
  rows: number;
  sha256: string;
}

export interface Sources {
  version: 1;
  datasetId: string;
  communities: string[];
  files: SourceFile[];
}

const SOURCE_KEYS = ["file", "table", "query", "querySha256", "date", "bytesProcessed", "rows", "sha256"];

export function readSources(path: string): Sources {
  const fail = (why: string): never => {
    throw new Error(`${path}: ${why}`);
  };
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    return fail(`cannot read it as JSON (${(e as Error).message})`);
  }
  if (typeof json !== "object" || json === null || Array.isArray(json)) return fail("must be a JSON object");
  const o = json as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    if (!["version", "datasetId", "communities", "files"].includes(k)) fail(`unknown key "${k}"`);
  }
  if (o.version !== 1) fail(`version must be 1, got ${JSON.stringify(o.version)}`);
  if (typeof o.datasetId !== "string" || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(o.datasetId)) fail(`datasetId ${JSON.stringify(o.datasetId)} is not a dataset id`);
  if (!Array.isArray(o.communities) || o.communities.length === 0) fail("communities must be a list of at least one name");
  for (const c of o.communities as unknown[]) {
    if (typeof c !== "string" || !/^hive-[0-9]+$/.test(c)) fail(`communities: ${JSON.stringify(c)} is not hive-<digits>`);
  }
  if (!Array.isArray(o.files) || o.files.length === 0) fail("files must be a list of at least one raw file");

  const seen = new Set<string>();
  const tables = new Set<string>();
  const files: SourceFile[] = [];
  (o.files as unknown[]).forEach((entry, i) => {
    const where = `files entry ${i + 1}`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) return fail(`${where} must be an object`);
    const e = entry as Record<string, unknown>;
    for (const k of Object.keys(e)) if (!SOURCE_KEYS.includes(k)) fail(`${where}: unknown key "${k}"`);
    for (const k of SOURCE_KEYS) if (!(k in e)) fail(`${where}: missing key "${k}"`);
    if (typeof e.file !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.csv$/.test(e.file)) {
      fail(`${where}: file ${JSON.stringify(e.file)} is not a plain .csv file name`);
    }
    const file = e.file as string;
    if (typeof e.table !== "string" || !(HIVE_TABLES as string[]).includes(e.table)) {
      fail(`${where} (${file}): table ${JSON.stringify(e.table)} is not one of ${HIVE_TABLES.join(", ")}`);
    }
    if (typeof e.query !== "string" || !/^[A-Za-z0-9._/-]+$/.test(e.query)) fail(`${where} (${file}): query ${JSON.stringify(e.query)} is not a file path`);
    for (const k of ["querySha256", "sha256"]) {
      if (typeof e[k] !== "string" || !/^[0-9a-f]{64}$/.test(e[k] as string)) fail(`${where} (${file}): ${k} ${JSON.stringify(e[k])} is not 64 lowercase hex digits`);
    }
    if (typeof e.date !== "string" || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(e.date)) fail(`${where} (${file}): date ${JSON.stringify(e.date)} is not YYYY-MM-DD`);
    for (const k of ["bytesProcessed", "rows"]) {
      if (typeof e[k] !== "number" || !Number.isSafeInteger(e[k]) || (e[k] as number) < 0) {
        fail(`${where} (${file}): ${k} ${JSON.stringify(e[k])} is not a non-negative integer`);
      }
    }
    if (seen.has(file)) fail(`file ${file} is listed twice`);
    seen.add(file);
    tables.add(e.table as string);
    files.push(e as unknown as SourceFile);
  });
  for (const t of HIVE_TABLES) if (!tables.has(t)) fail(`no file for the table "${t}"`);
  return { version: 1, datasetId: o.datasetId as string, communities: o.communities as string[], files };
}

/** Reads and checks every raw file (SHA-256, UTF-8, header, row count) and returns the rows. Writes nothing. */
function readRaw(rawDir: string, sources: Sources): HiveRaw {
  const raw: HiveRaw = { posts: [], votes: [], replies: [], reblogs: [], subscribes: [], follows: [] };
  for (const s of [...sources.files].sort((a, b) => byteCompare(a.file, b.file))) {
    const path = join(rawDir, s.file);
    if (!existsSync(path)) throw new Error(`${s.file}: file not found in ${rawDir} (table ${s.table}, query ${s.query})`);
    const bytes = readFileSync(path);
    const got = sha256Hex(bytes);
    if (got !== s.sha256) throw new Error(`${s.file}: SHA-256 is ${got}, sources.json says ${s.sha256}. Nothing was read and nothing was written.`);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      throw new Error(`${s.file}: not valid UTF-8`);
    }
    const rows = parseHiveCsv(text, s.file, s.table);
    if (rows.length !== s.rows) throw new Error(`${s.file}: ${rows.length} rows, sources.json says ${s.rows}`);
    (raw[s.table] as Array<{ file: string; rows: unknown[] }>).push({ file: s.file, rows });
  }
  return raw;
}

// ---------------------------------------------------------------- the format check

/**
 * Hive has no rule that an author joins a community before posting in it (design F7), so `community-non-member`
 * is counted and reported. Any other problem means the transform or the files are wrong, and the gate stops.
 */
export function acceptFormat(res: FormatResult): { nonMemberPosts: number; problems: Problem[] } {
  const other = res.problems.filter((p) => p.rule !== "community-non-member");
  if (other.length > 0) {
    throw new Error(`checkFormat found problems: ${other.map((p) => `${p.rule}: ${p.count} (first: ${p.example})`).join("; ")}`);
  }
  const nonMember = res.problems.find((p) => p.rule === "community-non-member");
  return { nonMemberPosts: nonMember ? nonMember.count : 0, problems: res.problems };
}

// ---------------------------------------------------------------- the gate number

export interface GateBucketRow extends BucketRow {
  /** Kept test users of this bucket with a membership whose joined_at is before t_u. */
  keptWithMembership: number;
}

/**
 * Walks the test users the way bucketReport does, with the same exported helpers, and counts for each bucket the
 * kept ones that have a membership before their test time. The same as-of rule as userFeaturesAsOf: joined_at < t_u.
 * It also counts the kept users of each bucket again, and stops if that differs from bucketReport.
 */
function withMembership(data: Dataset, report: BucketReport, windowSec: number, poolCap: number): GateBucketRow[] {
  const pos: Event[] = data.interactions
    .map((e) => ({ id: e.eventId, t: e.createdAt, user: e.userId, post: e.postId }))
    .sort((a, b) => a.t - b.t || a.id - b.id);
  const byUser = new Map<number, Event[]>();
  for (const ev of pos) {
    const l = byUser.get(ev.user);
    if (l) l.push(ev);
    else byUser.set(ev.user, [ev]);
  }
  const authored = new Map<number, Set<number>>();
  const created = new Map<number, number>();
  for (const p of data.posts) {
    created.set(p.postId, p.createdAt);
    const s = authored.get(p.authorId);
    if (s) s.add(p.postId);
    else authored.set(p.authorId, new Set([p.postId]));
  }
  const ix = buildIndex(created);
  const firstJoin = new Map<number, number>();
  for (const m of data.memberships) {
    const cur = firstJoin.get(m.userId);
    if (cur === undefined || m.joinedAt < cur) firstJoin.set(m.userId, m.joinedAt);
  }

  const none: ReadonlySet<number> = new Set();
  const kept = new Map<string, number>();
  const keptMember = new Map<string, number>();
  const add = (m: Map<string, number>, k: string): void => void m.set(k, (m.get(k) ?? 0) + 1);
  for (const [user, testEv] of testItems(pos, report.cutTime)) {
    const earlierEv = earlierEvents(byUser.get(user) as Event[], testEv);
    const label = bucketOf(earlierEv.length);
    const earlier = new Set(earlierEv.map((e) => e.post));
    if (!inPool(testEv.t, testEv.post, ix, authored.get(user) ?? none, earlier, windowSec, poolCap)) continue;
    const joined = firstJoin.get(user);
    for (const g of BUCKETS_0_4.includes(label) ? [label, "0-4"] : [label]) {
      add(kept, g);
      if (joined !== undefined && joined < testEv.t) add(keptMember, g);
    }
  }
  return report.rows.map((r) => {
    if ((kept.get(r.bucket) ?? 0) !== r.kept) {
      throw new Error(`gate cross-check failed: bucket ${r.bucket} has ${r.kept} kept users in bucketReport and ${kept.get(r.bucket) ?? 0} in the gate walk`);
    }
    return { ...r, keptWithMembership: keptMember.get(r.bucket) ?? 0 };
  });
}

// ---------------------------------------------------------------- gate.md

export interface GateResult {
  verdict: "pass" | "fail";
  /** Kept test users in bucket 0-4 with a membership before their test time. */
  gateNumber: number;
  threshold: number;
  datasetId: string;
  communities: string[];
  cutTime: number;
  report: BucketReport;
  bucketRows: GateBucketRow[];
  counts: HiveCounts;
  problems: Problem[];
  nonMemberPosts: number;
  likes: { total: number; within: number; share: number | null; windowSeconds: number };
  sources: SourceFile[];
  /** The text of gate.md. */
  text: string;
}

function f6(x: number | null): string {
  return x === null ? "n/a" : x.toFixed(6);
}

function row(cells: Array<string | number>): string {
  return `| ${cells.join(" | ")} |`;
}

function gateMarkdown(r: Omit<GateResult, "text">, frozen: { cutQuantile: number; windowDays: number; poolCap: number }): string {
  const b = r.report;
  const iso = new Date(b.cutTime * 1000).toISOString();
  const lines: string[] = [];
  lines.push(`# Gate result: Hive side check (${r.datasetId})`, "");
  lines.push(`Verdict: ${r.verdict === "pass" ? "PASS" : "FAIL"}`, "");
  lines.push(
    `Gate number: ${r.gateNumber} kept test users in bucket 0-4 with a community join before their test time t_u. ` +
      `The gate passes at ${r.threshold} or more (KEPT_THRESHOLD, blueprint section 3.2).`,
    "",
  );
  lines.push("## Settings", "");
  lines.push(`- Slice, communities (${r.communities.length}): ${r.communities.join(", ")}`);
  lines.push(`- q ${frozen.cutQuantile}, window W ${frozen.windowDays} days (${frozen.windowDays * DAY} s), pool cap N_max ${frozen.poolCap} (eval/config/frozen-v1.json)`);
  lines.push(`- Cut time T ${b.cutTime} (${iso})`);
  lines.push(`- Positives (likes, comments, reposts): ${b.n}; test users: ${b.testUsers}`);
  lines.push(`- Pool at T: ${b.poolAtT} (window only: ${b.poolAtTWindow}); median pool over kept test users: ${f6(b.poolMedian)}`);
  lines.push(`- Kept test users in bucket 0-4, with or without a join: ${b.kept04}`, "");

  lines.push("## Buckets", "");
  lines.push(row(["bucket", "test users", "kept", "left out", "kept with a followee", "kept with a join before t_u"]));
  lines.push(row(["---", "---", "---", "---", "---", "---"]));
  for (const x of r.bucketRows) lines.push(row([x.bucket, x.testUsers, x.kept, x.leftOut, x.keptWithFollowee, x.keptWithMembership]));
  lines.push("", "Bucket 0-4 is the union of the buckets 0 and 1-4. A test user is kept when the test post is in the pool at t_u (blueprint sections 3.1 and 3.2).", "");

  lines.push("## Sources", "");
  lines.push(row(["file", "table", "query", "query sha256", "date", "bytes processed", "rows", "file sha256"]));
  lines.push(row(["---", "---", "---", "---", "---", "---", "---", "---"]));
  const sources = [...r.sources].sort((a, b) => byteCompare(a.file, b.file));
  for (const s of sources) {
    lines.push(row([s.file, s.table, s.query, s.querySha256.slice(0, 12), s.date, s.bytesProcessed, s.rows, s.sha256.slice(0, 12)]));
  }
  lines.push("", `Total bytes processed: ${sources.reduce((n, s) => n + s.bytesProcessed, 0)}. Total rows: ${sources.reduce((n, s) => n + s.rows, 0)}. Hashes are cut to 12 digits here; sources.json has them whole.`, "");

  lines.push("## Transform counts", "", "```", ...hiveCountsTable(r.counts), "```", "");

  lines.push("## Format check", "");
  if (r.problems.length === 0) lines.push("No problem.");
  for (const p of r.problems) lines.push(`- ${p.rule}: ${p.count} (first: ${p.example})`);
  lines.push("", "Hive has no rule that an author joins a community before a post (design F7), so community-non-member is reported and does not change the gate.", "");

  lines.push("## Likes close to their post (design F9)", "");
  lines.push(
    `Likes within ${r.likes.windowSeconds} seconds of their post: ${r.likes.within} of ${r.likes.total} likes (${f6(r.likes.share)}). ` +
      "They are kept (Spec Open question 5).",
  );
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------- the gate

function outsideRepo(dir: string): boolean {
  const p = resolve(dir);
  return !(p === REPO || p.startsWith(REPO + sep));
}

/**
 * Runs the gate on the raw files of `rawDir` and returns the result with the text of gate.md. It writes the six
 * canonical tables to <scratchDir>/<datasetId>/ and nothing else. Every check of the raw files comes before the
 * first write.
 */
export function runGate(rawDir: string, scratchDir: string, sourcesPath: string = DEFAULT_SOURCES): GateResult {
  if (!outsideRepo(scratchDir)) throw new Error(`the scratch folder ${resolve(scratchDir)} must be outside the repo (design F10)`);
  const sources = readSources(sourcesPath);
  const raw = readRaw(rawDir, sources);
  const { tables, counts } = toHiveCanonical(raw, sources.communities);

  const dir = join(resolve(scratchDir), sources.datasetId);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const files: Record<string, FileEntry> = {};
  for (const t of TABLES) files[SCHEMAS[t].file] = writeTable(dir, t, tables[t]);
  const manifest: Manifest = {
    schemaVersion: 1,
    datasetId: sources.datasetId,
    source: { kind: "hive", communities: sources.communities, counts },
    epoch: { iso: "1970-01-01T00:00:00Z", seconds: 0 },
    node: process.version,
    files,
  };
  writeManifest(dir, manifest);

  const { nonMemberPosts, problems } = acceptFormat(checkFormat(dir));
  const data = loadDataset(dir);
  const frozen = loadFrozen();
  const windowSec = frozen.windowDays * DAY;
  const report = bucketReport(data, String(frozen.cutQuantile), windowSec, frozen.poolCap);
  const bucketRows = withMembership(data, report, windowSec, frozen.poolCap);
  const gateNumber = (bucketRows.find((x) => x.bucket === "0-4") as GateBucketRow).keptWithMembership;

  const created = new Map(data.posts.map((p) => [p.postId, p.createdAt]));
  let total = 0;
  let within = 0;
  for (const e of data.interactions) {
    if (e.type !== "like") continue;
    total++;
    if (e.createdAt - (created.get(e.postId) as number) <= BOT_WINDOW_SECONDS) within++;
  }

  const result: Omit<GateResult, "text"> = {
    verdict: gateNumber >= KEPT_THRESHOLD ? "pass" : "fail",
    gateNumber,
    threshold: KEPT_THRESHOLD,
    datasetId: sources.datasetId,
    communities: sources.communities,
    cutTime: report.cutTime,
    report,
    bucketRows,
    counts,
    problems,
    nonMemberPosts,
    likes: { total, within, share: total === 0 ? null : within / total, windowSeconds: BOT_WINDOW_SECONDS },
    sources: sources.files,
  };
  return { ...result, text: gateMarkdown(result, frozen) };
}

// ---------------------------------------------------------------- the CLI

const USAGE = "usage: node gate.ts <rawDir> <scratchDir> [--out <gate.md>] [--sources <sources.json>]";

function main(argv: string[]): void {
  checkNode();
  const positional: string[] = [];
  let out = DEFAULT_OUT;
  let sources = DEFAULT_SOURCES;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string;
    if (a === "--out" || a === "--sources") {
      const v = argv[++i];
      if (v === undefined) throw new Error(USAGE);
      if (a === "--out") out = resolve(v);
      else sources = resolve(v);
    } else if (a.startsWith("--")) throw new Error(USAGE);
    else positional.push(a);
  }
  if (positional.length !== 2) throw new Error(USAGE);
  const [rawDir, scratchDir] = positional as [string, string];
  const r = runGate(resolve(rawDir), resolve(scratchDir), sources);
  writeFileSync(out, r.text, "utf8");
  const stdout = [
    `gate: ${r.verdict === "pass" ? "PASS" : "FAIL"}`,
    `gate number: ${r.gateNumber} (threshold ${r.threshold})`,
    `T: ${r.cutTime} (${new Date(r.cutTime * 1000).toISOString()})`,
    `kept test users in bucket 0-4: ${r.report.kept04} of ${(r.bucketRows.find((x) => x.bucket === "0-4") as GateBucketRow).testUsers} test users in bucket 0-4`,
    `positives: ${r.report.n}`,
    `likes within ${r.likes.windowSeconds} s of their post: ${r.likes.within} of ${r.likes.total}`,
    `posts by non-members (reported): ${r.nonMemberPosts}`,
    `wrote ${out}`,
  ];
  process.stdout.write(stdout.join("\n") + "\n");
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${(e as Error).message}\n`);
    process.exitCode = 1;
  }
}
