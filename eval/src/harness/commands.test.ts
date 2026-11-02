import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { harnessCommand, rankCommand } from "./commands.ts";
import { prepare, rankAt, runDataset } from "./run.ts";
import { fixedVariants } from "./config.ts";
import type { RunConfig } from "./config.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { tempDir } from "../checks/fixture.ts";
import { loadFrozen } from "../frozen.ts";
import { positiveEvents } from "./index-data.ts";
import { splitItems } from "./split.ts";

const frozen = loadFrozen();
const T = frozen.cutTimes["syn-W2M-S"] as number;
const data = loadDataset(new URL("../../data/syn-W2M-S", import.meta.url).pathname);

// TC8 / DW10: `rank` prints the order behind a user's per_user rank.
const CFG: RunConfig = {
  datasets: ["syn-W2M-S"],
  split: "validation",
  methods: ["BL0", "BL2", "BL3", "BL5", "BL6", "H"],
  params: { BL5: { gravity: 1.8 }, BL6: { alpha: 2 }, H: { alpha: 2, beta: 4, m: "frozen" } },
  pool: "normal",
  mode: "fast",
};
const run = runDataset("syn-W2M-S", data, { split: "validation", variants: fixedVariants(CFG), pool: "normal", mode: "fast" }, { expectedT: T });
const items = splitItems(positiveEvents(data), T, "validation");

const FLAGS: Record<string, string[]> = {
  BL0: [],
  BL2: [],
  BL3: [],
  BL5: ["--param", "gravity=1.8"],
  BL6: ["--param", "alpha=2"],
  H: ["--param", "alpha=2", "--param", "beta=4", "--param", `m=${frozen.priorStrength}`],
};

function cases(): Array<{ method: string; user: number; rank: number; post: number }> {
  const out: Array<{ method: string; user: number; rank: number; post: number }> = [];
  const methods = ["H", "BL2", "BL3", "BL5", "BL0", "BL6"];
  let i = 0;
  for (const row of run.perUser) {
    // Spread the cases over methods and over users, skipping nothing: every row of per_user is a kept user.
    if (row.method === methods[i % methods.length] && row.userId % 7 === i % 7) {
      out.push({ method: row.method, user: row.userId, rank: row.rank, post: row.testPostId });
      i++;
      if (out.length === 5) break;
    }
  }
  return out;
}

test("rank prints the pool in the order behind the user's per_user rank (5 cases)", () => {
  const chosen = cases();
  assert.equal(chosen.length, 5);
  assert.ok(new Set(chosen.map((c) => c.method)).size >= 4);
  for (const c of chosen) {
    const item = items.get(c.user)!;
    const args = ["--dataset", "syn-W2M-S", "--method", c.method, "--user", String(c.user), "--asof", String(item.t), "--before-event", String(item.id), "--top", "100000", ...(FLAGS[c.method] as string[])];
    const lines = rankCommand(args);
    const ids = lines.map(Number);
    assert.ok(ids.length > 50, `${c.method} user ${c.user}: pool of ${ids.length}`);
    assert.equal(ids.indexOf(c.post) + 1, c.rank, `${c.method} user ${c.user}`);
    // --top cuts the same list.
    assert.deepEqual(rankCommand([...args.slice(0, args.indexOf("--top")), "--top", "10", ...args.slice(args.indexOf("--top") + 2)]).map(Number), ids.slice(0, 10));
  }
});

test("rank takes the params from a run config or from flags, and stops on a missing one", () => {
  const item = items.get(1) ?? items.values().next().value!;
  const base = ["--dataset", "syn-W2M-S", "--user", String(item.user), "--asof", String(item.t), "--before-event", String(item.id), "--top", "20"];
  const dir = tempDir();
  const cfgPath = join(dir, "r.json");
  writeFileSync(cfgPath, JSON.stringify(CFG));
  const fromConfig = rankCommand([...base, "--method", "H", "--config", cfgPath]);
  const fromFlags = rankCommand([...base, "--method", "H", ...(FLAGS.H as string[])]);
  assert.deepEqual(fromConfig, fromFlags);
  assert.throws(() => rankCommand([...base, "--method", "H", "--param", "alpha=2"]), /beta|param/);
  assert.throws(() => rankCommand([...base, "--method", "BL9"]), /BL9/);
  assert.throws(() => rankCommand([...base, "--method", "BL4", "--config", cfgPath]), /BL4/); // not in the config
  assert.throws(() => rankCommand(["--dataset", "syn-W2M-S", "--method", "BL2"]), /--user|--asof|--top/);
});

test("rank without --before-event uses the strict rule of the live app (events at t are not visible)", () => {
  const item = items.values().next().value!;
  const without = rankCommand(["--dataset", "syn-W2M-S", "--method", "BL3", "--user", String(item.user), "--asof", String(item.t), "--top", "30"]);
  const direct = rankAt(prepare("syn-W2M-S", data, "fast"), item.user, { t: item.t }, { label: "BL3", method: "BL3", params: {} }, "normal");
  assert.deepEqual(without, direct.slice(0, 30).map(String));
  // A user id in the u0000000042 form is the same user.
  const asString = rankCommand(["--dataset", "syn-W2M-S", "--method", "BL3", "--user", `u${String(item.user).padStart(10, "0")}`, "--asof", String(item.t), "--top", "30"]);
  assert.deepEqual(asString, without);
});

function writeConfig(dir: string, over: Partial<RunConfig> = {}, name = "tmp-run.json"): string {
  const cfg: RunConfig = { datasets: ["syn-W2M-S"], split: "validation", methods: ["BL1", "BL2", "BL3"], params: {}, pool: "normal", mode: "fast", ...over };
  const path = join(dir, name);
  writeFileSync(path, JSON.stringify(cfg, null, 2) + "\n");
  return path;
}

test("harness runs a config into --out, prints one line per dataset and the manifest hash, and runs twice to the same bytes", () => {
  const cfgDir = tempDir();
  const cfg = writeConfig(cfgDir);
  const a = tempDir();
  const b = tempDir();
  const outA = harnessCommand([cfg, "--out", a]);
  const outB = harnessCommand([cfg, "--out", b]);
  assert.deepEqual(readdirSync(a).sort((x, y) => (x < y ? -1 : 1)), ["coverage.csv", "leftout.csv", "manifest.json", "per_user.csv", "summary.csv"]);
  for (const f of readdirSync(a)) assert.equal(readFileSync(join(a, f), "utf8"), readFileSync(join(b, f), "utf8"), f);
  assert.ok(outA.some((l) => l.startsWith("syn-W2M-S") && l.includes(`T ${T}`)));
  assert.ok(outA.some((l) => /manifest sha256 [0-9a-f]{64}/.test(l)));
  assert.deepEqual(outA.map((l) => l.replaceAll(a, "<out>")), outB.map((l) => l.replaceAll(b, "<out>")));
});

test("harness stops on a test-split config without approval, before it loads any data", () => {
  const cfg = writeConfig(tempDir(), { split: "test" });
  const out = tempDir();
  assert.throws(() => harnessCommand([cfg, "--out", out]), /testApprovedBy/);
  assert.deepEqual(readdirSync(out), []);
  assert.throws(() => harnessCommand([writeConfig(tempDir(), { datasets: ["no-such-dataset"] }), "--out", out]), /cutTimes|no-such-dataset/);
});

test("harness --record-t prints T and the recorded T, counts the split's items, and writes no results", () => {
  const cfg = writeConfig(tempDir(), { datasets: ["syn-W2M-S", "syn-W0-S"] });
  const out = tempDir();
  const lines = harnessCommand([cfg, "--record-t", "--out", out]);
  assert.deepEqual(readdirSync(out), []);
  assert.ok(lines.some((l) => l.includes("syn-W2M-S") && l.includes(`T ${T}`) && l.includes(`recorded ${T}`) && l.includes("equal")), lines.join("\n"));
  assert.ok(lines.some((l) => /^\s*all\b/.test(l)));
});

test("harness with a grid config tunes first, writes tuning.csv, and runs the chosen values", () => {
  const cfg = writeConfig(tempDir(), { methods: ["BL2", "BL2t"], params: { BL2t: { ageWeight: "grid" } } });
  const out = tempDir();
  harnessCommand([cfg, "--out", out]);
  assert.ok(existsSync(join(out, "tuning.csv")));
  const tuning = readFileSync(join(out, "tuning.csv"), "utf8").trimEnd().split("\n");
  assert.equal(tuning.length, 1 + frozen.baselineGrids.BL2t.length);
  const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as { files: Record<string, unknown> };
  assert.ok("tuning.csv" in manifest.files);
  // The BL2t row of summary.csv is the run at the chosen value: equal to a fixed run at that value.
  const chosen = tuning.slice(1).find((l) => l.endsWith(",1")) as string;
  const value = Number(chosen.split(",")[3]);
  const fixed = tempDir();
  harnessCommand([writeConfig(tempDir(), { methods: ["BL2t"], params: { BL2t: { ageWeight: value } } }), "--out", fixed]);
  const pick = (dir: string): string[] => readFileSync(join(dir, "summary.csv"), "utf8").split("\n").filter((l) => l.includes(",BL2t,"));
  assert.deepEqual(pick(out), pick(fixed));
});
