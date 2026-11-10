import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { loadDataset } from "../canonical/dataset.ts";
import { loadFrozen } from "../frozen.ts";
import { rankCommand } from "../harness/commands.ts";
import { prepare, rankAt } from "../harness/run.ts";
import { PARITY_ALGOS, expectedOrders, orderSha256 } from "./expected.ts";
import { drawParityPairs } from "./sample.ts";

// TC14, the expected orders.
const frozen = loadFrozen();
const data = loadDataset(new URL("../../data/syn-W2M-S", import.meta.url).pathname);
const prep = prepare("syn-W2M-S", data, "fast");
const pairs = drawParityPairs(prep, data, { n: 8, perBucket: 2, maxDraws: 200_000 });
const params = { alpha: 2, beta: 4, m: frozen.priorStrength };
const rows = expectedOrders(prep, pairs, params);

test("the algo to method map is chrono BL0, engagement BL2, social H", () => {
  assert.deepEqual(PARITY_ALGOS.map((a) => [a.algo, a.method]), [["chrono", "BL0"], ["engagement", "BL2"], ["social", "H"]]);
});

test("one row per pair and algo, sorted by pair and then in the order of the map", () => {
  assert.equal(rows.length, pairs.length * PARITY_ALGOS.length);
  const keys = rows.map((r) => `${r.pair}/${r.algo}`);
  const want = pairs.flatMap((p) => PARITY_ALGOS.map((a) => `${p.pair}/${a.algo}`));
  assert.deepEqual(keys, want);
});

test("expectedOrders equals rankAt for each pair and method", () => {
  for (const r of rows) {
    const p = pairs[r.pair - 1]!;
    const variant = { label: r.method, method: r.method, params: r.method === "H" ? params : {} };
    const order = rankAt(prep, p.user, { t: p.asOf }, variant, "normal");
    assert.deepEqual(r.order, order);
    assert.equal(r.poolSize, order.length);
    assert.equal(r.poolSize, p.poolSize);
    assert.deepEqual(r.top20, order.slice(0, 20));
    assert.equal(r.orderSha256, orderSha256(order));
  }
});

test("the top of each row is what the `rank` command prints", () => {
  for (const r of rows.filter((x) => x.pair <= 3)) {
    const p = pairs[r.pair - 1]!;
    const flags = r.method === "H" ? ["--param", "alpha=2", "--param", "beta=4", "--param", `m=${frozen.priorStrength}`] : [];
    const printed = rankCommand(["--dataset", "syn-W2M-S", "--method", r.method, "--user", String(p.user), "--asof", String(p.asOf), "--top", "20", ...flags]);
    assert.deepEqual(printed.map(Number), r.top20);
  }
});

test("orderSha256 is the SHA-256 of the ids joined by newlines, with no final newline", () => {
  const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex");
  assert.equal(orderSha256([5, 3, 9]), sha("5\n3\n9"));
  assert.notEqual(orderSha256([5, 3, 9]), sha("5\n3\n9\n"));
  assert.equal(orderSha256([7]), sha("7"));
  assert.equal(orderSha256([]), sha(""));
  assert.notEqual(orderSha256([5, 3, 9]), orderSha256([3, 5, 9]));
});
