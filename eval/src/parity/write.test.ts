import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../canonical/csv.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { tempDir } from "../checks/fixture.ts";
import { loadFrozen } from "../frozen.ts";
import { prepare } from "../harness/run.ts";
import { expectedOrders } from "./expected.ts";
import { drawParityPairs } from "./sample.ts";
import { writeParity } from "./write.ts";
import type { ParityWriteInput } from "./write.ts";

// TC14, the files.
const frozen = loadFrozen();
const DIR = new URL("../../data/syn-W2M-S", import.meta.url).pathname;
const data = loadDataset(DIR);
const prep = prepare("syn-W2M-S", data, "fast");
const pairs = drawParityPairs(prep, data, { n: 8, perBucket: 2, maxDraws: 200_000 });
const params = { alpha: 1, beta: 1, m: frozen.priorStrength };
const expected = expectedOrders(prep, pairs, params);

const input: ParityWriteInput = {
  runId: "p6-parity",
  datasetId: "syn-W2M-S",
  datasetManifestSha256: sha256Hex(readFileSync(join(DIR, "manifest.json"))),
  epochSeconds: data.manifest.epoch.seconds,
  firstPostUnix: data.manifest.epoch.seconds + Math.min(...data.posts.map((p) => p.createdAt)),
  counts: { users: data.users.length, posts: data.posts.length, interactions: data.interactions.length },
  params,
  pairs,
  expected,
};

function write(): { out: string; ext: string } {
  const out = tempDir("parity-out-");
  const ext = tempDir("parity-ext-");
  writeParity(input, { outDir: out, externalDir: ext });
  return { out, ext };
}

const read = (dir: string, name: string): string => readFileSync(join(dir, name), "utf8");
const byName = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

test("two writes give byte-identical files", () => {
  const a = write();
  const b = write();
  assert.deepEqual(readdirSync(a.out).sort(byName), ["expected.csv", "manifest.json", "pairs.csv"]);
  assert.deepEqual(readdirSync(a.ext), ["orders.csv"]);
  for (const name of ["pairs.csv", "expected.csv", "manifest.json"]) assert.equal(read(a.out, name), read(b.out, name), name);
  assert.equal(read(a.ext, "orders.csv"), read(b.ext, "orders.csv"));
});

test("pairs.csv has the columns of the design and as_of_unix is the epoch plus as_of", () => {
  const { out } = write();
  const lines = read(out, "pairs.csv").split("\n");
  assert.equal(lines[0], "pair,user_id,as_of,as_of_unix,bucket,n_history,n_followees,n_communities,pool_size");
  assert.equal(lines.length, pairs.length + 2); // header, rows, final newline
  assert.equal(lines[lines.length - 1], "");
  const first = lines[1]!.split(",");
  const p = pairs[0]!;
  assert.deepEqual(first, [p.pair, p.user, p.asOf, input.epochSeconds + p.asOf, p.bucket, p.nHistory, p.nFollowees, p.nCommunities, p.poolSize].map(String));
});

test("expected.csv has the columns of the design, one row per pair and algo, and a space-separated top20", () => {
  const { out } = write();
  const lines = read(out, "expected.csv").split("\n");
  assert.equal(lines[0], "pair,algo,method,pool_size,order_sha256,top20");
  assert.equal(lines.length, expected.length + 2);
  const r = expected[0]!;
  assert.deepEqual(lines[1]!.split(","), [String(r.pair), r.algo, r.method, String(r.poolSize), r.orderSha256, r.top20.join(" ")]);
});

test("orders.csv has the whole order of every row and stays out of the committed folder", () => {
  const { out, ext } = write();
  assert.equal(existsSync(join(out, "orders.csv")), false);
  const lines = read(ext, "orders.csv").split("\n");
  assert.equal(lines[0], "pair,algo,order");
  const r = expected[1]!;
  assert.equal(lines[2], `${r.pair},${r.algo},${r.order.join(" ")}`);
});

test("manifest.json has the params, the map, the epoch, the counts and the hash of every file", () => {
  const { out, ext } = write();
  const text = read(out, "manifest.json");
  const m = JSON.parse(text);
  assert.equal(text, JSON.stringify(m, null, 2) + "\n", "two-space JSON with a final LF");
  assert.equal(m.runId, "p6-parity");
  assert.equal(m.schemaVersion, 1);
  assert.equal(m.masterSeed, frozen.masterSeed);
  assert.equal(m.node, process.version);
  assert.deepEqual(m.dataset, { id: "syn-W2M-S", manifestSha256: input.datasetManifestSha256 });
  assert.deepEqual(m.params, { alpha: 1, beta: 1, m: frozen.priorStrength });
  assert.deepEqual(m.methods, { chrono: "BL0", engagement: "BL2", social: "H" });
  assert.equal(m.epochSeconds, input.epochSeconds);
  assert.equal(m.firstPostUnix, input.firstPostUnix);
  assert.deepEqual(m.counts, input.counts);
  assert.deepEqual(m.external, ["orders.csv"]);
  assert.deepEqual(Object.keys(m.files).sort(byName), ["expected.csv", "orders.csv", "pairs.csv"]);
  assert.equal(m.files["pairs.csv"].rows, pairs.length);
  assert.equal(m.files["expected.csv"].rows, expected.length);
  assert.equal(m.files["orders.csv"].rows, expected.length);
  for (const name of ["pairs.csv", "expected.csv"]) assert.equal(m.files[name].sha256, sha256Hex(read(out, name)), name);
  assert.equal(m.files["orders.csv"].sha256, sha256Hex(read(ext, "orders.csv")));
});
