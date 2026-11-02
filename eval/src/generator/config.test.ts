import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, makeParams, loadTargets, WORLDS, SIZES } from "./config.ts";
import { loadFrozen } from "../frozen.ts";

test("every parameter is marked calibrated or chosen, and calibrated ones have a target", () => {
  const c = loadConfig();
  for (const [name, p] of Object.entries(c.params)) {
    assert.ok(p.kind === "calibrated" || p.kind === "chosen", name);
    assert.equal(typeof p.value, "number", name);
    if (p.kind === "calibrated") assert.ok(p.targets && p.targets.length > 0, `${name} needs a target`);
    else assert.equal(p.targets, undefined, name);
  }
  for (const w of WORLDS) {
    for (const p of Object.values(c.worlds[w])) assert.ok(p.kind === "chosen" || p.kind === "calibrated");
  }
});

test("targets come from the config: four calibration keys", () => {
  const t = loadTargets(loadConfig());
  assert.deepEqual(Object.keys(t).sort(), ["activitySkewTop20", "followeesMean", "votesPerUserMean", "votesPerUserMedian"]);
  assert.equal(t.votesPerUserMean, 21.65);
});

test("makeParams reads sizes and the epoch span from the frozen values", () => {
  const f = loadFrozen();
  const p = makeParams(loadConfig(), f, "W2M", "M");
  assert.equal(p.nUsers, f.sizes.M.users);
  assert.equal(p.nPosts, f.sizes.M.posts);
  assert.equal(p.spanStart, 180 * 86400);
  assert.equal(p.spanEnd, 250 * 86400);
  assert.equal(p.influenceSocial, 2);
  assert.equal(makeParams(loadConfig(), f, "W0", "S").homophily, 0);
  assert.deepEqual([...SIZES], ["S", "M"]);
});

test("the three W2 cells differ only in influence, at the same homophily as W1", () => {
  const c = loadConfig();
  const f = loadFrozen();
  const w1 = makeParams(c, f, "W1", "M");
  const cells = (["W2L", "W2M", "W2H"] as const).map((w) => makeParams(c, f, w, "M"));
  for (const p of cells) assert.equal(p.homophily, w1.homophily);
  assert.ok(cells[0]!.influenceSocial < cells[1]!.influenceSocial && cells[1]!.influenceSocial < cells[2]!.influenceSocial);
  assert.equal(w1.influenceSocial, 0);
  assert.equal(w1.influenceCommunity, 0);
});
