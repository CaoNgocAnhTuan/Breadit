import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { writeResults, resultTexts, PER_USER_COMMIT_LIMIT_BYTES } from "./write.ts";
import { runDataset } from "./run.ts";
import type { RunResult } from "./run.ts";
import { fixedVariants } from "./config.ts";
import type { RunConfig } from "./config.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { tempDir } from "../checks/fixture.ts";
import { METHOD_ORDER } from "../metrics.ts";

const GOLDEN = new URL("./fixtures/golden", import.meta.url).pathname;
const CONFIG: RunConfig = {
  datasets: ["golden"],
  split: "validation",
  methods: ["BL0", "BL1", "BL2", "BL3", "H"],
  params: { H: { alpha: 2, beta: 4, m: 5 } },
  pool: "normal",
  mode: "fast",
};

function result(): RunResult {
  const run = runDataset("golden", loadDataset(GOLDEN), { split: "validation", variants: fixedVariants(CONFIG), pool: "normal", mode: "fast" }, { expectedT: 673200 });
  return { datasets: [run], inputs: { golden: sha256Hex(readFileSync(join(GOLDEN, "manifest.json"))) } };
}

function opts(dir: string, ext: string, over: object = {}) {
  return { runId: "unit", outDir: dir, externalDir: ext, configText: JSON.stringify(CONFIG), ...over };
}

test("writeResults writes the four files and a manifest with rows and SHA-256 of each", () => {
  const out = tempDir();
  const ext = tempDir();
  const m = writeResults(result(), opts(out, ext));
  assert.deepEqual(readdirSync(out).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)), ["coverage.csv", "leftout.csv", "manifest.json", "per_user.csv", "summary.csv"]);
  assert.deepEqual(readdirSync(ext), []);
  assert.deepEqual(Object.keys(m.files), ["coverage.csv", "leftout.csv", "per_user.csv", "summary.csv"]);
  for (const [name, entry] of Object.entries(m.files)) {
    const text = readFileSync(join(out, name), "utf8");
    assert.equal(entry.sha256, sha256Hex(text), name);
    assert.equal(entry.rows, text.split("\n").length - 2, name);
  }
  const onDisk = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8"));
  assert.deepEqual(onDisk, JSON.parse(JSON.stringify(m)));
  assert.equal(m.node, process.version);
  assert.equal(m.runId, "unit");
  assert.equal(m.source.configSha256, sha256Hex(JSON.stringify(CONFIG)));
  assert.match(m.source.datasets.golden as string, /^[0-9a-f]{64}$/);
  assert.equal(m.external, undefined);
  // Keys sorted, two-space JSON, LF at the end.
  const text = readFileSync(join(out, "manifest.json"), "utf8");
  assert.ok(text.endsWith("}\n") && !text.includes("\r"));
  assert.deepEqual(Object.keys(JSON.parse(text)), ["files", "masterSeed", "node", "runId", "schemaVersion", "source"]);
});

test("a per_user.csv over the limit goes to the external folder, and its hash stays in the manifest", () => {
  const out = tempDir();
  const ext = tempDir();
  const t = resultTexts(result());
  const size = Buffer.byteLength(t.perUser, "utf8");
  const m = writeResults(result(), opts(out, ext, { perUserLimitBytes: size }));
  assert.equal(existsSync(join(out, "per_user.csv")), false);
  assert.equal(readFileSync(join(ext, "per_user.csv"), "utf8"), t.perUser);
  assert.deepEqual(m.external, ["per_user.csv"]);
  assert.equal(m.files["per_user.csv"]?.sha256, sha256Hex(t.perUser));
  // One byte under the size keeps it in the results folder.
  const out2 = tempDir();
  writeResults(result(), opts(out2, tempDir(), { perUserLimitBytes: size + 1 }));
  assert.ok(existsSync(join(out2, "per_user.csv")));
  assert.equal(PER_USER_COMMIT_LIMIT_BYTES, 5 * 1024 * 1024);
});

test("two writes into two empty folders give byte-identical files (double run)", () => {
  const a = tempDir();
  const b = tempDir();
  writeResults(result(), opts(a, tempDir()));
  writeResults(result(), opts(b, tempDir()));
  for (const name of readdirSync(a)) assert.equal(readFileSync(join(a, name), "utf8"), readFileSync(join(b, name), "utf8"), name);
});

test("rows are sorted by dataset, split, method order and user id, whatever the order of the run", () => {
  const r = result();
  const run = r.datasets[0]!;
  const shuffled: RunResult = { ...r, datasets: [{ ...run, perUser: [...run.perUser].reverse(), summary: [...run.summary].reverse(), coverage: [...run.coverage].reverse(), leftOut: [...run.leftOut].reverse() }] };
  assert.deepEqual(resultTexts(shuffled), resultTexts(r));
  const lines = resultTexts(r).perUser.trimEnd().split("\n").slice(1);
  const keys = lines.map((l) => l.split(",")).map((c) => [METHOD_ORDER.indexOf(c[2] as string), Number(c[3])]);
  for (let i = 1; i < keys.length; i++) {
    const p = keys[i - 1] as number[];
    const q = keys[i] as number[];
    assert.ok(p[0]! < q[0]! || (p[0] === q[0] && p[1]! < q[1]!));
  }
});
