import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, cpSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkAll, bucketVerdict } from "./run.ts";
import type { BucketReport } from "./buckets.ts";
import { generateDataset, datasetDir } from "../generator/generate.ts";
import { tempDir, writeFixture } from "./fixture.ts";

test("checkAll passes on a generated size S dataset and prints the manifest SHA-256", () => {
  const out = tempDir();
  generateDataset("syn-W2M-S", out);
  const r = checkAll(out);
  assert.equal(r.pass, true);
  assert.match(r.text, /syn-W2M-S/);
  assert.match(r.text, /format: pass/);
  assert.match(r.text, /manifest sha256 [0-9a-f]{64}/);
  assert.match(r.text, /synthetic-v1\.json sha256 [0-9a-f]{64}/);
});

test("checkAll is deterministic", () => {
  const out = tempDir();
  generateDataset("syn-W0-S", out);
  assert.equal(checkAll(out).text, checkAll(out).text);
});

test("checkAll fails when a file changed after the manifest was written", () => {
  const out = tempDir();
  generateDataset("syn-W0-S", out);
  appendFileSync(join(datasetDir(out, "syn-W0-S"), "users.csv"), "9999,0\n");
  const r = checkAll(out);
  assert.equal(r.pass, false);
  assert.match(r.text, /sha256/);
});

test("checkAll fails on an empty folder and on a folder that is not a dataset", () => {
  const empty = tempDir();
  assert.equal(checkAll(empty).pass, false);
  const odd = tempDir();
  mkdirSync(join(odd, "something"));
  writeFileSync(join(odd, "something", "a.txt"), "x\n");
  assert.equal(checkAll(odd).pass, false);
});

test("the check command exits 0 on good data and 1 on bad data", () => {
  const out = tempDir();
  generateDataset("syn-W1-S", out);
  const script = new URL("../cli/check.ts", import.meta.url).pathname;
  const good = spawnSync(process.execPath, [script, out], { encoding: "utf8" });
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /syn-W1-S/);
  appendFileSync(join(datasetDir(out, "syn-W1-S"), "users.csv"), "9999,0\n");
  const bad = spawnSync(process.execPath, [script, out], { encoding: "utf8" });
  assert.equal(bad.status, 1);
});

test("the gen command writes one line per dataset", () => {
  const out = tempDir();
  const script = new URL("../cli/generate.ts", import.meta.url).pathname;
  const text = execFileSync(process.execPath, [script, out, "syn-W0-S", "syn-W1-S"], { encoding: "utf8" });
  const lines = text.trim().split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[0] as string, /^syn-W0-S .*[0-9a-f]{64}$/);
});

test("TC14: the bucket check fails when bucket 0 has no kept test user", () => {
  const report = (kept0: number, test0: number): BucketReport => ({
    q: "0.8", n: 1000, cutTime: 100, testUsers: 300, poolAtT: 10, poolAtTWindow: 10, poolMedian: 10,
    rows: [
      { bucket: "0", testUsers: test0, kept: kept0, leftOut: test0 - kept0, keptWithFollowee: 0 },
      { bucket: "1-4", testUsers: 200, kept: 190, leftOut: 10, keptWithFollowee: 100 },
      { bucket: "0-4", testUsers: 200 + test0, kept: 190 + kept0, leftOut: 10, keptWithFollowee: 100 },
      { bucket: "5-19", testUsers: 50, kept: 50, leftOut: 0, keptWithFollowee: 30 },
      { bucket: "20+", testUsers: 50, kept: 50, leftOut: 0, keptWithFollowee: 30 },
    ],
    kept04: 190 + kept0,
    meetsThreshold: 190 + kept0 >= 100,
  });
  const good = bucketVerdict(report(12, 14), 0);
  assert.equal(good.pass, true);
  assert.match(good.lines.join("\n"), /kept test users in bucket 0: 12/);
  const empty = bucketVerdict(report(0, 0), 0);
  assert.equal(empty.pass, false);
  assert.match(empty.lines.join("\n"), /bucket 0: 0.*FAIL/);
  // bucket 0-4 above 100 does not hide an empty bucket 0
  assert.equal(report(0, 0).meetsThreshold, true);
});

// ---------------------------------------------------------------- TC6: the bucket table for digg2009

/** A Digg-shaped folder: `source.kind` "digg", the Unix epoch, no community. 799 likes, 159 test users, all in bucket 0. */
function diggShaped(): string {
  const users = [];
  const interactions = [];
  const follows = [];
  for (let u = 1; u <= 800; u++) {
    users.push({ user_id: u, joined_at: 0 });
    if (u > 1) {
      follows.push({ follower_id: u, followee_id: 1, created_at: 100 });
      interactions.push({ event_id: u - 1, user_id: u, post_id: (u % 20) + 1, type: "like", created_at: 5000 + u });
    }
  }
  const posts = [];
  for (let p = 1; p <= 20; p++) posts.push({ post_id: p, author_id: 1, community_id: null, created_at: 1000 + p });
  const dir = writeFixture({ users, follows, posts, interactions }, {
    datasetId: "digg2009",
    manifest: (m) => ({ ...m, source: { kind: "digg" } }),
  });
  const parent = tempDir();
  cpSync(dir, join(parent, "digg2009"), { recursive: true });
  return parent;
}

test("TC6: a digg2009 folder gets the format check and a bucket table, and no calibration or lift", () => {
  const r = checkAll(diggShaped());
  assert.match(r.text, /== digg2009 ==/);
  assert.match(r.text, /format: pass/);
  assert.match(r.text, /buckets \(q 0\.8\): positives 799, T 5641 \(1970-01-01T01:34:01\.000Z\), test users 159/);
  assert.match(r.text, /kept test users in bucket 0-4: 159 \(threshold 100\): pass/);
  assert.match(r.text, /kept_with_followee/);
  assert.doesNotMatch(r.text, /calibration/);
  assert.doesNotMatch(r.text, /lift/);
  assert.equal(r.pass, true);
});

test("TC6: the digg2009 bucket table fails when fewer than 100 test users are kept in bucket 0-4", () => {
  // two likes only: the same shape with a much smaller crowd
  const small = writeFixture(
    {
      users: [{ user_id: 1, joined_at: 0 }, { user_id: 2, joined_at: 0 }, { user_id: 3, joined_at: 0 }],
      posts: [{ post_id: 1, author_id: 1, community_id: null, created_at: 10 }],
      interactions: [
        { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 20 },
        { event_id: 2, user_id: 3, post_id: 1, type: "like", created_at: 30 },
      ],
    },
    { datasetId: "digg2009", manifest: (m) => ({ ...m, source: { kind: "digg" } }) },
  );
  const parent = tempDir();
  cpSync(small, join(parent, "digg2009"), { recursive: true });
  const r = checkAll(parent);
  assert.match(r.text, /buckets \(q 0\.8\)/);
  assert.equal(r.pass, false);
});

test("TC6: syn-W2M-M still gets its bucket table, next to digg2009", () => {
  const parent = diggShaped();
  generateDataset("syn-W2M-M", parent);
  const r = checkAll(parent);
  const syn = r.text.slice(r.text.indexOf("== syn-W2M-M =="), r.text.indexOf("== digg2009 =="));
  assert.match(syn, /calibration:/);
  assert.match(syn, /buckets \(q 0\.8\)/);
  assert.match(r.text.slice(r.text.indexOf("== digg2009 ==")), /buckets \(q 0\.8\)/);
});
