import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sha256Hex } from "./canonical/csv.ts";
import { canonicalJson } from "./canonical/manifest.ts";
import { GROUPS_HEADER, ORIENT_RUN, groupRows, orientCommand, orientGroup } from "./orient.ts";

// The Orientation group comparison (exploratory): the group bounds, the rows from a tiny per_user.csv, the hash check and two equal runs.

const OPTS = { masterSeed: 1, resamples: 200, level: 0.95 };
const HEADER = "dataset,split,method,user_id,bucket,n_history,n_followees,test_post_id,rank";

/** One user: [id, n_history, rank of H, rank of BL2]. */
function perUser(users: ReadonlyArray<[string, number, number, number]>, extra: string[] = []): string {
  const lines = [HEADER];
  for (const method of ["BL2", "H"]) {
    for (const [id, h, rh, rb] of users) lines.push(`dsA,test,${method},${id},x,${h},0,1,${method === "H" ? rh : rb}`);
  }
  return [...lines, ...extra].join("\n") + "\n";
}

test("orientGroup: 5 or fewer is 0-5, more than 20 is 21+, 6 to 20 is in neither group", () => {
  assert.equal(orientGroup(0), "0-5");
  assert.equal(orientGroup(5), "0-5");
  assert.equal(orientGroup(6), null);
  assert.equal(orientGroup(20), null);
  assert.equal(orientGroup(21), "21+");
  assert.throws(() => orientGroup(-1), /n_history/);
  assert.throws(() => orientGroup(2.5), /n_history/);
});

test("groupRows: means, paired differences and the user count of each group and metric", () => {
  // u1 and u2 are in 0-5, u3 in 21+, u4 (10) in neither. Rows of another method or of the validation split are ignored.
  const text = perUser(
    [
      ["u1", 0, 1, 11],
      ["u2", 5, 3, 3],
      ["u3", 21, 2, 20],
      ["u4", 10, 1, 50],
    ],
    ["dsA,test,BL4,u1,x,0,0,1,1", "dsA,validation,H,u9,x,0,0,1,1"],
  );
  const rows = groupRows(text, OPTS);
  assert.equal(rows.length, 4);
  for (const r of rows) assert.equal(r.length, GROUPS_HEADER.length);
  const ndcg3 = (1 / Math.log2(4)).toFixed(6); // rank 3
  const ndcg2 = (1 / Math.log2(3)).toFixed(6); // rank 2
  assert.deepEqual(rows[0], ["dsA", "0-5", "recall", "10", "2", "1.000000", "0.500000", "0.500000", rows[0]?.[8], rows[0]?.[9]]);
  assert.deepEqual(rows[1]?.slice(0, 8), ["dsA", "0-5", "ndcg", "10", "2", ((1 + Number(ndcg3)) / 2).toFixed(6), (Number(ndcg3) / 2).toFixed(6), "0.500000"]);
  // one user: every resample is that user, so the interval is the difference itself
  assert.deepEqual(rows[2], ["dsA", "21+", "recall", "10", "1", "1.000000", "0.000000", "1.000000", "1.000000", "1.000000"]);
  assert.deepEqual(rows[3], ["dsA", "21+", "ndcg", "10", "1", ndcg2, "0.000000", ndcg2, ndcg2, ndcg2]);
  // the interval of the 0-5 rows lies between the smallest and the largest paired difference
  for (const r of rows.slice(0, 2)) assert.ok(Number(r[8]) >= 0 && Number(r[9]) <= 1 && Number(r[8]) <= Number(r[9]));
});

test("groupRows: two calls give the same rows", () => {
  const text = perUser([
    ["u1", 0, 1, 11],
    ["u2", 3, 4, 2],
    ["u3", 1, 30, 7],
    ["u5", 25, 2, 9],
  ]);
  assert.deepEqual(groupRows(text, OPTS), groupRows(text, OPTS));
});

test("groupRows: stops on a missing BL2 row, a different history and an empty group", () => {
  const missing = HEADER + "\n" + ["dsA,test,BL2,u1,x,0,0,1,4", "dsA,test,H,u1,x,0,0,1,4", "dsA,test,H,u2,x,0,0,1,4"].join("\n") + "\n";
  assert.throws(() => groupRows(missing, OPTS), /rows/);
  const history = HEADER + "\n" + ["dsA,test,BL2,u1,x,0,0,1,4", "dsA,test,H,u1,x,3,0,1,4"].join("\n") + "\n";
  assert.throws(() => groupRows(history, OPTS), /n_history/);
  assert.throws(() => groupRows(perUser([["u1", 0, 1, 2]]), OPTS), /no user in group 21\+/);
});

/** A results folder with p7-main/manifest.json and an external per_user.csv in the raw folder. */
function fixture(): { results: string; raw: string; root: string } {
  const root = mkdtempSync(join(tmpdir(), "eval-orient-"));
  const results = join(root, "results");
  const raw = join(root, "raw");
  const text = perUser([
    ["u1", 0, 1, 11],
    ["u2", 5, 3, 3],
    ["u3", 21, 2, 20],
  ]);
  mkdirSync(join(results, "p7-main"), { recursive: true });
  mkdirSync(join(raw, "p7-main"), { recursive: true });
  writeFileSync(join(raw, "p7-main", "per_user.csv"), text);
  const manifest = { schemaVersion: 1, runId: "p7-main", files: { "per_user.csv": { rows: 6, sha256: sha256Hex(text) } }, external: ["per_user.csv"] };
  writeFileSync(join(results, "p7-main", "manifest.json"), canonicalJson(manifest));
  return { results, raw, root };
}

test("orientCommand: writes groups.csv and a manifest that lists it; a second run writes the same bytes", () => {
  const f = fixture();
  try {
    const args = ["--results-dir", f.results, "--raw-dir", f.raw];
    orientCommand(args);
    const csv1 = readFileSync(join(f.results, ORIENT_RUN, "groups.csv"), "utf8");
    const man1 = readFileSync(join(f.results, ORIENT_RUN, "manifest.json"), "utf8");
    assert.equal(csv1.split("\n")[0], GROUPS_HEADER.join(","));
    const m = JSON.parse(man1) as { files: Record<string, { sha256: string; rows: number }> };
    assert.equal(m.files["groups.csv"]?.sha256, sha256Hex(csv1));
    assert.equal(m.files["groups.csv"]?.rows, 4);
    orientCommand(args);
    assert.equal(readFileSync(join(f.results, ORIENT_RUN, "groups.csv"), "utf8"), csv1);
    assert.equal(readFileSync(join(f.results, ORIENT_RUN, "manifest.json"), "utf8"), man1);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});

test("orientCommand: a per_user.csv that does not match the manifest stops it, and nothing is written", () => {
  const f = fixture();
  try {
    const path = join(f.raw, "p7-main", "per_user.csv");
    writeFileSync(path, readFileSync(path, "utf8").replace("u1,x,0,0,1,1", "u1,x,0,0,1,2"));
    assert.throws(() => orientCommand(["--results-dir", f.results, "--raw-dir", f.raw]), /per_user\.csv has SHA-256/);
    assert.equal(existsSync(join(f.results, ORIENT_RUN)), false);
  } finally {
    rmSync(f.root, { recursive: true, force: true });
  }
});
