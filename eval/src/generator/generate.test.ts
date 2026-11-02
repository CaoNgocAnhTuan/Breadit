import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { datasetIds, generateDataset, datasetDir } from "./generate.ts";
import { tempDir } from "../checks/fixture.ts";
import { checkFormat } from "../checks/format.ts";
import { readManifest } from "../canonical/manifest.ts";
import { sha256Hex } from "../canonical/csv.ts";

const FILES = ["users.csv", "follows.csv", "communities.csv", "memberships.csv", "posts.csv", "interactions.csv", "manifest.json"];

test("datasetIds: the eight datasets of blueprint section 4, in a fixed order", () => {
  assert.deepEqual(datasetIds(), [
    "syn-W0-S", "syn-W1-S", "syn-W2M-S", "syn-W0-M", "syn-W1-M", "syn-W2L-M", "syn-W2M-M", "syn-W2H-M",
  ]);
});

test("two runs of syn-W2M-S give byte-identical manifest and CSV files", () => {
  const a = tempDir();
  const b = tempDir();
  const ma = generateDataset("syn-W2M-S", a);
  const mb = generateDataset("syn-W2M-S", b);
  assert.deepEqual(ma, mb);
  for (const f of FILES) {
    const x = readFileSync(join(datasetDir(a, "syn-W2M-S"), f));
    const y = readFileSync(join(datasetDir(b, "syn-W2M-S"), f));
    assert.equal(sha256Hex(x), sha256Hex(y), f);
  }
});

test("the manifest has the keys of blueprint section 2.3 and the SHA-256 of each file", () => {
  const out = tempDir();
  generateDataset("syn-W1-S", out);
  const m = readManifest(datasetDir(out, "syn-W1-S"));
  assert.equal(m.datasetId, "syn-W1-S");
  assert.equal(m.masterSeed, 20261014);
  assert.equal(m.epoch.seconds, 1767225600);
  assert.equal(m.node, process.version);
  assert.equal(m.source.kind, "synthetic");
  assert.match(String(m.source.configSha256), /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(m.files), ["communities.csv", "follows.csv", "interactions.csv", "memberships.csv", "posts.csv", "users.csv"]);
  for (const [name, e] of Object.entries(m.files)) {
    assert.equal(e.sha256, sha256Hex(readFileSync(join(datasetDir(out, "syn-W1-S"), name))));
  }
});

test("a generated dataset passes the format check, including D1", () => {
  const out = tempDir();
  generateDataset("syn-W2M-S", out);
  const r = checkFormat(datasetDir(out, "syn-W2M-S"));
  assert.deepEqual(r.problems, []);
  assert.equal(r.pass, true);
});

test("syn-W1-S and syn-W2M-S share users, follows, communities, memberships and posts (shared streams)", () => {
  const out = tempDir();
  generateDataset("syn-W1-S", out);
  generateDataset("syn-W2M-S", out);
  for (const f of ["users.csv", "follows.csv", "communities.csv", "memberships.csv", "posts.csv"]) {
    assert.equal(
      readFileSync(join(datasetDir(out, "syn-W1-S"), f), "utf8"),
      readFileSync(join(datasetDir(out, "syn-W2M-S"), f), "utf8"),
      f,
    );
  }
  assert.notEqual(
    readFileSync(join(datasetDir(out, "syn-W1-S"), "interactions.csv"), "utf8"),
    readFileSync(join(datasetDir(out, "syn-W2M-S"), "interactions.csv"), "utf8"),
  );
});

test("the generator deletes and rewrites the dataset folder (F10)", () => {
  const out = tempDir();
  const dir = datasetDir(out, "syn-W0-S");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "stale.txt"), "old\n");
  generateDataset("syn-W0-S", out);
  assert.equal(existsSync(join(dir, "stale.txt")), false);
  assert.equal(checkFormat(dir).pass, true);
});

test("the generator refuses an unknown id and a path outside the out dir (F10)", () => {
  const out = tempDir();
  assert.throws(() => generateDataset("../escape", out), /dataset id/);
  assert.throws(() => generateDataset("syn-W9-S", out), /dataset id/);
  assert.throws(() => datasetDir(out, "../escape"), /outside/);
});
