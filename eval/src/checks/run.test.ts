import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { checkAll } from "./run.ts";
import { generateDataset, datasetDir } from "../generator/generate.ts";
import { tempDir } from "./fixture.ts";

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
