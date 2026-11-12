import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { sha256Hex } from "../../../eval/src/canonical/csv.ts";
import { loadDataset } from "../../../eval/src/canonical/dataset.ts";
import { KEPT_THRESHOLD, bucketReport } from "../../../eval/src/checks/buckets.ts";
import { tempDir } from "../../../eval/src/checks/fixture.ts";
import { loadFrozen } from "../../../eval/src/frozen.ts";
import { HIVE_COLUMNS } from "./hive-transform.ts";
import type { HiveTable } from "./hive-transform.ts";
import { acceptFormat, runGate } from "./gate.ts";

// TC2 of plan.md. The raw files are made here, in a temp folder, with their sources.json. The scenario is built so
// that every number can be worked out by hand:
//  - posts post-0 to post-7 (authors author-aa and author-bb, community hive-100001) and one old post;
//  - "test users" whose last like comes after the cut time T and whose history is the likes before T;
//  - filler users whose likes fill the time before T, so that exactly the test likes come after T
//    (T is the time of the like at rank ceil(0.8 n), blueprint section 3.1).

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..", "..");
const POST_T = 1_000_000;
const FILLER_T = 1_100_000;
const TEST_T = 1_200_000;
const COMMUNITY = "hive-100001";
const DATASET = "hive-fixture";
const DAY = 86400;

type Member = "before" | "at" | "after" | "none";
interface TestUser {
  /** Likes before T (the bucket of the test user). */
  history: number;
  /** When the user joins the community, compared with the time t_u of the test like. */
  member: Member;
  /** The test like is on a post older than the window. */
  old?: boolean;
}

// likes close to their post: [post number, seconds after the post]. 7 of the 8 are within 300 seconds.
const EXTRA_LIKES: Array<[number, number]> = [
  [0, 10],
  [0, 20],
  [0, 30],
  [0, 100],
  [0, 200],
  [0, 299],
  [1, 300], // exactly 300 seconds: counts
  [1, 301], // 301 seconds: does not count
];

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}

function csv(table: HiveTable, rows: string[][]): string {
  return [HIVE_COLUMNS[table].join(","), ...rows.map((r) => r.join(","))].join("\n") + "\n";
}

interface Scenario {
  rawDir: string;
  sourcesPath: string;
  /** The cut time T worked out by hand. */
  cutTime: number;
  /** Number of likes (all positives). */
  likes: number;
  files: Record<string, string>;
}

function scenario(users: TestUser[]): Scenario {
  const postRows: string[][] = [];
  const postTime = (i: number): number => POST_T + i;
  const authorOf = (i: number): string => (i % 2 === 0 ? "author-aa" : "author-bb");
  for (let i = 0; i < 8; i++) postRows.push([authorOf(i), `post-${i}`, COMMUNITY, String(postTime(i))]);
  postRows.push(["author-aa", "post-old", COMMUNITY, "1"]);

  const early: string[][] = []; // likes before T
  let k = 0; // position on the filler timeline
  users.forEach((u, i) => {
    for (let j = 0; j < u.history; j++) early.push([`tester-${pad(i, 3)}`, authorOf(j), `post-${j}`, "10000", String(FILLER_T + k++)]);
  });
  const prior = k;
  EXTRA_LIKES.forEach(([p, offset], i) => {
    early.push([`bot-${pad(i, 3)}`, authorOf(p), `post-${p}`, "10000", String(postTime(p) + offset)]);
  });
  // The fillers: the smallest F with ceil(0.8 n) = the number of likes before T, n = all likes.
  const before = (f: number): number => prior + f + EXTRA_LIKES.length;
  let fillers = 0;
  while (Math.floor((4 * (before(fillers) + users.length) + 4) / 5) !== before(fillers)) {
    fillers++;
    assert.ok(fillers < 100_000, "the fixture has too many history likes for the filler rule");
  }
  for (let f = 0; f < fillers; f++) {
    early.push([`filler-${pad(f, 4)}`, authorOf(f % 8), `post-${f % 8}`, "10000", String(FILLER_T + k++)]);
  }
  const cutTime = FILLER_T + prior + fillers - 1;

  const test: string[][] = [];
  const subs: string[][] = [["author-bb", COMMUNITY, "1"]];
  users.forEach((u, i) => {
    const name = `tester-${pad(i, 3)}`;
    const t = TEST_T + 10 * i;
    test.push(u.old ? [name, "author-aa", "post-old", "10000", String(t)] : [name, "author-bb", "post-7", "10000", String(t)]);
    if (u.member === "before") subs.push([name, COMMUNITY, String(t - 1)]);
    else if (u.member === "at") subs.push([name, COMMUNITY, String(t)]);
    else if (u.member === "after") subs.push([name, COMMUNITY, String(t + 1)]);
  });

  const files: Record<string, string> = {
    "posts.csv": csv("posts", postRows),
    "votes-2021-01.csv": csv("votes", early),
    "votes-2021-02.csv": csv("votes", test),
    "replies.csv": csv("replies", []),
    "reblogs.csv": csv("reblogs", []),
    "subscribes.csv": csv("subscribes", subs),
    "follows.csv": csv("follows", [["tester-000", "author-bb", '"[""blog""]"', "5"]]),
  };
  const dir = tempDir("gate-raw-");
  const tableOf = (file: string): HiveTable => file.replace(/(-[0-9]{4}-[0-9]{2})?\.csv$/, "") as HiveTable;
  const entries = Object.keys(files)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((file) => {
      writeFileSync(join(dir, file), files[file] as string, "utf8");
      return {
        file,
        table: tableOf(file),
        query: "queries/q-fixture.sql",
        querySha256: sha256Hex("select 1"),
        date: "2026-11-13",
        bytesProcessed: 1000,
        rows: (files[file] as string).split("\n").length - 2,
        sha256: sha256Hex(files[file] as string),
      };
    });
  const sourcesPath = join(tempDir("gate-src-"), "sources.json");
  writeSources(sourcesPath, entries);
  return { rawDir: dir, sourcesPath, cutTime, likes: early.length + test.length, files };
}

function writeSources(path: string, files: unknown[]): void {
  writeFileSync(path, JSON.stringify({ version: 1, datasetId: DATASET, communities: [COMMUNITY], files }, null, 2) + "\n", "utf8");
}

/** G users who count (history 0 or 2, joined before) and 14 decoys, each with a different reason to stay out. */
function users(g: number): TestUser[] {
  const g0 = Math.ceil(0.6 * g);
  const out: TestUser[] = [];
  for (let i = 0; i < g0; i++) out.push({ history: 0, member: "before" });
  for (let i = g0; i < g; i++) out.push({ history: 2, member: "before" });
  for (let i = 0; i < 3; i++) out.push({ history: 0, member: "at" }); // joined at t_u: not before
  for (let i = 0; i < 3; i++) out.push({ history: 0, member: "after" });
  for (let i = 0; i < 4; i++) out.push({ history: 0, member: "none" });
  for (let i = 0; i < 2; i++) out.push({ history: 5, member: "before" }); // bucket 5-19
  for (let i = 0; i < 2; i++) out.push({ history: 0, member: "before", old: true }); // test post out of the window
  return out;
}

function expectedRows(g: number) {
  const g0 = Math.ceil(0.6 * g);
  const g1 = g - g0;
  return [
    { bucket: "0", testUsers: g0 + 12, kept: g0 + 10, leftOut: 2, keptWithFollowee: 1, keptWithMembership: g0 },
    { bucket: "1-4", testUsers: g1, kept: g1, leftOut: 0, keptWithFollowee: 0, keptWithMembership: g1 },
    { bucket: "0-4", testUsers: g + 12, kept: g + 10, leftOut: 2, keptWithFollowee: 1, keptWithMembership: g },
    { bucket: "5-19", testUsers: 2, kept: 2, leftOut: 0, keptWithFollowee: 0, keptWithMembership: 2 },
    { bucket: "20+", testUsers: 0, kept: 0, leftOut: 0, keptWithFollowee: 0, keptWithMembership: 0 },
  ];
}

// ---------------------------------------------------------------- the gate number and the verdict

test("TC2: at 100 the gate passes; the number counts only kept bucket 0-4 users with a join strictly before t_u", () => {
  const s = scenario(users(100));
  const scratch = tempDir("gate-scratch-");
  const r = runGate(s.rawDir, scratch, s.sourcesPath);
  assert.equal(r.cutTime, s.cutTime);
  assert.equal(r.report.n, s.likes);
  // 3 users joined at exactly t_u, 3 after, 4 never, 2 have a test post out of the window, 2 are in bucket 5-19:
  // none of them counts. A "<=" instead of "<" would give 103.
  assert.equal(r.gateNumber, 100);
  assert.equal(r.threshold, KEPT_THRESHOLD);
  assert.equal(r.verdict, "pass");
  assert.deepEqual(r.bucketRows, expectedRows(100));
  assert.equal(r.report.kept04, 110); // kept in bucket 0-4, with or without a join
  assert.match(r.text, /Verdict: PASS/);
});

test("TC2: at 99 the gate fails (the threshold is KEPT_THRESHOLD)", () => {
  const s = scenario(users(99));
  const r = runGate(s.rawDir, tempDir("gate-scratch-"), s.sourcesPath);
  assert.equal(r.gateNumber, 99);
  assert.equal(r.verdict, "fail");
  assert.deepEqual(r.bucketRows, expectedRows(99));
  // 109 kept users in bucket 0-4 would pass the plain bucket check: the join is what fails the gate
  assert.equal(r.report.kept04, 109);
  assert.equal(r.report.meetsThreshold, true);
  assert.match(r.text, /Verdict: FAIL/);
});

test("TC2: the bucket table equals bucketReport on the tables the gate wrote, and gate.md shows it", () => {
  const s = scenario(users(100));
  const scratch = tempDir("gate-scratch-");
  const r = runGate(s.rawDir, scratch, s.sourcesPath);
  const f = loadFrozen();
  const rep = bucketReport(loadDataset(join(scratch, DATASET)), String(f.cutQuantile), f.windowDays * DAY, f.poolCap);
  assert.deepEqual(r.report, rep);
  for (const row of r.bucketRows) {
    const cells = [row.bucket, row.testUsers, row.kept, row.leftOut, row.keptWithFollowee, row.keptWithMembership];
    assert.ok(r.text.includes(`| ${cells.join(" | ")} |`), `gate.md has the row of bucket ${row.bucket}`);
  }
  assert.ok(r.text.includes(`T ${s.cutTime} (`), "gate.md shows T in Unix seconds");
  assert.ok(r.text.includes(new Date(s.cutTime * 1000).toISOString()), "gate.md shows T as an ISO time");
});

test("TC2: the share of likes within 300 seconds of their post (design F9)", () => {
  const s = scenario(users(100));
  const r = runGate(s.rawDir, tempDir("gate-scratch-"), s.sourcesPath);
  assert.equal(r.likes.within, 7);
  assert.equal(r.likes.total, s.likes);
  assert.equal(r.likes.windowSeconds, 300);
  assert.equal(r.likes.share, 7 / s.likes);
  assert.ok(r.text.includes(`7 of ${s.likes} likes`));
});

test("TC2: the drop counts of the transform and the sources are in gate.md", () => {
  const s = scenario(users(100));
  const r = runGate(s.rawDir, tempDir("gate-scratch-"), s.sourcesPath);
  assert.equal(r.counts.likes, s.likes);
  assert.equal(r.counts.posts, 9);
  // joins: 100 users who count, 3 at t_u, 3 after, 2 in bucket 5-19, 2 with an old post (4 users never join), and author-bb
  assert.equal(r.counts.memberships, 111);
  assert.match(r.text, /vote rows read\s+\d+/);
  for (const file of Object.keys(s.files)) assert.ok(r.text.includes(file), `gate.md lists ${file}`);
  assert.ok(r.text.includes("bytes processed"));
});

// ---------------------------------------------------------------- the checks that stop the gate

test("TC2: a posts-by-non-members count is reported, not fatal (design F7)", () => {
  const s = scenario(users(100));
  const r = runGate(s.rawDir, tempDir("gate-scratch-"), s.sourcesPath);
  // author-aa has no join: its 4 recent posts and the old post. author-bb joined at time 1: its 4 posts are fine.
  assert.equal(r.nonMemberPosts, 5);
  assert.deepEqual(
    r.problems.map((p) => p.rule),
    ["community-non-member"],
  );
  assert.match(r.text, /community-non-member: 5/);
});

test("TC2: any other problem of checkFormat stops the gate", () => {
  const fine = { datasetId: "x", pass: false, problems: [{ rule: "community-non-member", count: 3, example: "post 1" }] };
  assert.deepEqual(acceptFormat(fine), { nonMemberPosts: 3, problems: fine.problems });
  assert.deepEqual(acceptFormat({ datasetId: "x", pass: true, problems: [] }), { nonMemberPosts: 0, problems: [] });
  const other = { datasetId: "x", pass: false, problems: [...fine.problems, { rule: "own-post", count: 2, example: "event 9" }] };
  assert.throws(() => acceptFormat(other), /own-post: 2 \(first: event 9\)/);
});

test("TC2: a changed raw file stops runGate before anything is written", () => {
  const s = scenario(users(100));
  writeFileSync(join(s.rawDir, "votes-2021-02.csv"), (s.files["votes-2021-02.csv"] as string).replace("tester-001", "tester-002"), "utf8");
  const scratch = tempDir("gate-scratch-");
  assert.throws(() => runGate(s.rawDir, scratch, s.sourcesPath), /votes-2021-02\.csv: SHA-256 is [0-9a-f]{64}, sources\.json says [0-9a-f]{64}/);
  assert.deepEqual(readdirSync(scratch), []);
});

test("TC2: a missing raw file and a wrong row count stop runGate before anything is written", () => {
  const s = scenario(users(100));
  const scratch = tempDir("gate-scratch-");

  const sources = JSON.parse(readFileSync(s.sourcesPath, "utf8")) as { files: Array<{ file: string; rows: number }> };
  const wrong = JSON.parse(JSON.stringify(sources)) as typeof sources;
  (wrong.files.find((f) => f.file === "posts.csv") as { rows: number }).rows += 1;
  const wrongPath = join(tempDir("gate-src-"), "sources.json");
  writeSources(wrongPath, wrong.files);
  assert.throws(() => runGate(s.rawDir, scratch, wrongPath), /posts\.csv: 9 rows, sources\.json says 10/);

  const missing = tempDir("gate-raw-"); // an empty folder
  assert.throws(() => runGate(missing, scratch, s.sourcesPath), /follows\.csv: file not found/);
  assert.deepEqual(readdirSync(scratch), []);
});

test("TC2: sources.json is checked strictly", () => {
  const s = scenario(users(100));
  const good = (JSON.parse(readFileSync(s.sourcesPath, "utf8")) as { files: Array<Record<string, unknown>> }).files;
  const write = (files: unknown[], extra?: Record<string, unknown>): string => {
    const p = join(tempDir("gate-src-"), "sources.json");
    writeFileSync(p, JSON.stringify({ version: 1, datasetId: DATASET, communities: [COMMUNITY], files, ...extra }), "utf8");
    return p;
  };
  const run = (p: string): unknown => runGate(s.rawDir, tempDir("gate-scratch-"), p);
  const one = (change: Record<string, unknown>): unknown[] => good.map((f, i) => (i === 0 ? { ...f, ...change } : f));

  assert.throws(() => run(write(one({ table: "nothing" }))), /table "nothing"/);
  assert.throws(() => run(write(one({ file: "../posts.csv" }))), /file "\.\.\/posts\.csv"/);
  assert.throws(() => run(write(one({ sha256: "abc" }))), /sha256/);
  assert.throws(() => run(write(one({ date: "13 Nov" }))), /date/);
  assert.throws(() => run(write(one({ bytesProcessed: -1 }))), /bytesProcessed/);
  assert.throws(() => run(write(one({ rows: 1.5 }))), /rows/);
  assert.throws(() => run(write([good[0], good[0]])), /twice/);
  assert.throws(() => run(write(good.filter((f) => f.table !== "follows"))), /no file for the table "follows"/);
  assert.throws(() => run(write(good, { version: 2 })), /version/);
  assert.throws(() => run(write(good, { communities: [] })), /communities/);
  assert.throws(() => run(write(good, { datasetId: "../x" })), /datasetId/);
});

// ---------------------------------------------------------------- determinism and the files it writes

test("TC2: gate.md from two runs is byte-identical and holds no path of this machine", () => {
  const s = scenario(users(100));
  const a = tempDir("gate-scratch-");
  const b = tempDir("gate-scratch-");
  const r1 = runGate(s.rawDir, a, s.sourcesPath);
  const r2 = runGate(s.rawDir, b, s.sourcesPath);
  assert.equal(r1.text, r2.text);
  assert.deepEqual(r1, { ...r2 });
  assert.ok(!r1.text.includes(a) && !r1.text.includes(s.rawDir));
  // a second run into the same scratch folder replaces the old tables
  assert.equal(runGate(s.rawDir, a, s.sourcesPath).text, r1.text);
});

test("TC2: the scratch folder must be outside the repo", () => {
  const s = scenario(users(100));
  const inside = join(REPO, "eval", ".gate-test-scratch");
  assert.throws(() => runGate(s.rawDir, inside, s.sourcesPath), /outside the repo/);
  assert.equal(existsSync(inside), false);
  assert.throws(() => runGate(s.rawDir, REPO, s.sourcesPath), /outside the repo/);
});

function snapshot(): string {
  // Everything git sees in the repo, ignored files included, except this task folder (where other work goes on).
  const r = spawnSync("git", ["status", "--porcelain", "--ignored", "--", ".", ":!.docs/works/2026-11-12-p7-hive-check"], {
    cwd: REPO,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  return r.stdout;
}

test("TC2: the CLI writes only the --out file; nothing else changes in the repo", () => {
  const s = scenario(users(100));
  const scratch = tempDir("gate-scratch-");
  const out = join(tempDir("gate-out-"), "gate.md");
  const taskGate = join(HERE, "gate.md");
  const taskGateBefore = existsSync(taskGate) ? statSync(taskGate).mtimeMs : null;
  const before = snapshot();
  const run = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(HERE, "gate.ts"), s.rawDir, scratch, "--out", out, "--sources", s.sourcesPath],
    { cwd: tempDir("gate-cwd-"), encoding: "utf8" },
  );
  assert.equal(run.status, 0, run.stderr);
  const expected = runGate(s.rawDir, tempDir("gate-scratch-"), s.sourcesPath);
  assert.equal(readFileSync(out, "utf8"), expected.text);
  assert.match(run.stdout, /gate: PASS/);
  assert.match(run.stdout, /gate number: 100 \(threshold 100\)/);
  assert.equal(snapshot(), before);
  assert.equal(existsSync(taskGate) ? statSync(taskGate).mtimeMs : null, taskGateBefore, "gate.md of the task folder is not touched");
});

test("TC2: the CLI stops with exit code 1 and writes no gate.md when a raw file changed", () => {
  const s = scenario(users(100));
  writeFileSync(join(s.rawDir, "follows.csv"), "follower,following,what,t\n", "utf8");
  const out = join(tempDir("gate-out-"), "gate.md");
  const run = spawnSync(
    process.execPath,
    ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(HERE, "gate.ts"), s.rawDir, tempDir("gate-scratch-"), "--out", out, "--sources", s.sourcesPath],
    { encoding: "utf8" },
  );
  assert.equal(run.status, 1);
  assert.match(run.stderr, /follows\.csv: SHA-256/);
  assert.equal(existsSync(out), false);
  const usage = spawnSync(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", join(HERE, "gate.ts")], { encoding: "utf8" });
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /usage: node gate\.ts <rawDir> <scratchDir>/);
});
