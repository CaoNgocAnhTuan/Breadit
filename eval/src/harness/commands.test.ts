import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { harnessCommand, rankCommand } from "./commands.ts";
import { computeCutTime, prepare, rankAt, runDataset } from "./run.ts";
import { fixedVariants } from "./config.ts";
import type { RunConfig } from "./config.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { tempDir, writeFixture } from "../checks/fixture.ts";
import { sha256Hex } from "../canonical/csv.ts";
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

// TC7 (design DW3, DW7): the harness command writes compare.csv and density.csv, and checks the H0 gate.
// A small world named syn-W0-M (the gate needs that name). Twelve users follow user 100, who liked an old post P first; each of
// the twelve then likes P as their only positive. Twelve newer posts, each liked by user 102, rank above P for BL2 (P is old).
// H with a large alpha puts P first, so H beats BL2 for each of the twelve; with alpha 0, H is BL2.
const DAY = 86400;
function gateWorld(): { dataDir: string; cutTimes: Record<string, number> } {
  const rows = (n: number): number[] => Array.from({ length: n }, (_, i) => i);
  const viewers = rows(12).map((i) => i + 1);
  const users = [...viewers, 100, 101, 102, 103].map((user_id) => ({ user_id, joined_at: 0 }));
  const follows = viewers.map((follower_id) => ({ follower_id, followee_id: 100, created_at: 0 }));
  const posts = [{ post_id: 1, author_id: 101, community_id: null, created_at: 0 }, ...rows(12).map((j) => ({ post_id: 2 + j, author_id: 101, community_id: null, created_at: 6 * DAY + j * 60 }))];
  const like = (event_id: number, user_id: number, post_id: number, created_at: number) => ({ event_id, user_id, post_id, type: "like", created_at });
  const interactions = [
    like(1, 100, 1, 3600),
    ...rows(12).map((j) => like(2 + j, 102, 2 + j, 6 * DAY + 7200 + j * 10)),
    ...viewers.map((i) => like(13 + i, i, 1, 6.5 * DAY + i * 60)),
    ...rows(12).map((j) => like(26 + j, 103, 2 + j, 6.8 * DAY + j * 60)),
  ];
  const one = writeFixture({ users, follows, posts, interactions }, { datasetId: "syn-W0-M" });
  const dataDir = tempDir();
  cpSync(one, join(dataDir, "syn-W0-M"), { recursive: true });
  const ds = loadDataset(join(dataDir, "syn-W0-M"));
  return { dataDir, cutTimes: { "syn-W0-M": computeCutTime(positiveEvents(ds)) } };
}

function gateConfig(alpha: number, over: Partial<RunConfig> = {}): RunConfig {
  return {
    datasets: ["syn-W0-M"],
    split: "validation",
    methods: ["BL2", "H"],
    params: { H: { alpha, beta: 1, m: "frozen" } },
    pool: "normal",
    mode: "fast",
    compare: { mode: "none", ref: "BL2" },
    density: true,
    h0Gate: true,
    ...over,
  };
}

test("harness with compare, density and h0Gate writes compare.csv and density.csv, lists both in the manifest, prints one H0 gate line", () => {
  const world = gateWorld();
  const cfg = writeConfig(tempDir(), gateConfig(0), "gate.json");
  const a = tempDir();
  const b = tempDir();
  const outA = harnessCommand([cfg, "--out", a], world);
  const outB = harnessCommand([cfg, "--out", b], world);
  assert.deepEqual(readdirSync(a).sort((x, y) => (x < y ? -1 : 1)), ["compare.csv", "coverage.csv", "density.csv", "leftout.csv", "manifest.json", "per_user.csv", "summary.csv"]);
  for (const f of readdirSync(a)) assert.equal(readFileSync(join(a, f), "utf8"), readFileSync(join(b, f), "utf8"), f);
  const gate = outA.filter((l) => l.startsWith("H0 gate:"));
  assert.equal(gate.length, 1);
  assert.match(gate[0] as string, /^H0 gate: pass {2}ci_low 0\.000000$/);
  assert.deepEqual(outA.map((l) => l.replaceAll(a, "<out>")), outB.map((l) => l.replaceAll(b, "<out>")));
  const manifest = JSON.parse(readFileSync(join(a, "manifest.json"), "utf8")) as { files: Record<string, { rows: number; sha256: string }> };
  for (const f of ["compare.csv", "density.csv"]) {
    assert.equal(manifest.files[f]?.sha256, sha256Hex(readFileSync(join(a, f), "utf8")), f);
  }
  // 1 method (H) x 3 K x 6 groups, family none, no p-value; density: 4 bins, n sums to the kept users
  const compare = readFileSync(join(a, "compare.csv"), "utf8").trimEnd().split("\n");
  assert.equal(compare.length, 1 + 18);
  assert.equal(manifest.files["compare.csv"]?.rows, 18);
  for (const l of compare.slice(1)) assert.match(l, /^syn-W0-M,none,H,BL2,\d+,[^,]+,\d+,[^,]*,[^,]*,[^,]*,,$/);
  const density = readFileSync(join(a, "density.csv"), "utf8").trimEnd().split("\n");
  assert.equal(density[0], "dataset,density_bin,method,ref,n,mean_diff,ci_low,ci_high");
  assert.deepEqual(density.slice(1).map((l) => l.split(",").slice(0, 2).join(",")), ["syn-W0-M,0", "syn-W0-M,1-4", "syn-W0-M,5-19", "syn-W0-M,20+"]);
  const kept = readFileSync(join(a, "leftout.csv"), "utf8").trimEnd().split("\n").find((l) => l.split(",")[2] === "all") as string;
  assert.equal(density.slice(1).reduce((n, l) => n + Number(l.split(",")[4]), 0), Number(kept.split(",")[3]) - Number(kept.split(",")[4]));
  assert.match(density[3] as string, /^syn-W0-M,5-19,H,BL2,0,,,$/);
});

test("when the H0 gate fails the command throws, after compare.csv, density.csv and the manifest are written", () => {
  const world = gateWorld();
  const cfg = writeConfig(tempDir(), gateConfig(1000), "gate.json");
  const out = tempDir();
  assert.throws(() => harnessCommand([cfg, "--out", out], world), (e: Error) => /H0 gate failed/.test(e.message) && /H0 gate: fail {2}ci_low 0\.\d{6}/.test(e.message));
  assert.deepEqual(readdirSync(out).sort((x, y) => (x < y ? -1 : 1)), ["compare.csv", "coverage.csv", "density.csv", "leftout.csv", "manifest.json", "per_user.csv", "summary.csv"]);
  const manifest = JSON.parse(readFileSync(join(out, "manifest.json"), "utf8")) as { files: Record<string, { sha256: string }> };
  for (const f of ["compare.csv", "density.csv", "summary.csv"]) assert.equal(manifest.files[f]?.sha256, sha256Hex(readFileSync(join(out, f), "utf8")), f);
  // the gate row of compare.csv: H - BL2, K 10, all, with the interval above 0
  const gate = readFileSync(join(out, "compare.csv"), "utf8").split("\n").find((l) => l.startsWith("syn-W0-M,none,H,BL2,10,all,")) as string;
  const cells = gate.split(",");
  assert.equal(cells[6], "15");
  assert.ok(Number(cells[8]) > 0, gate);
});

test("a config with compare but no density writes no density.csv, and compare needs no gate", () => {
  const world = gateWorld();
  const cfg = writeConfig(tempDir(), gateConfig(0, { density: undefined, h0Gate: undefined }), "plain.json");
  const out = tempDir();
  const lines = harnessCommand([cfg, "--out", out], world);
  assert.ok(existsSync(join(out, "compare.csv")));
  assert.ok(!existsSync(join(out, "density.csv")));
  assert.ok(!lines.some((l) => l.startsWith("H0 gate")));
});
