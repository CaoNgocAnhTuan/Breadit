import { test } from "node:test";
import assert from "node:assert/strict";
import { CoverageTracker, GROUPS, f6, ndcgAt, recallAt, summarize } from "./metrics.ts";
import type { RankRow } from "./metrics.ts";

// DW4: Recall@K = HitRate@K = [r <= K]; NDCG@K = 1 / log2(r + 1) for r <= K, else 0.

test("recallAt is 1 up to rank K and 0 after it", () => {
  assert.equal(recallAt(1, 10), 1);
  assert.equal(recallAt(10, 10), 1);
  assert.equal(recallAt(11, 10), 0);
  assert.equal(recallAt(500, 10), 0);
  assert.equal(recallAt(5, 5), 1);
  assert.equal(recallAt(6, 5), 0);
});

test("ndcgAt is 1 / log2(r + 1) up to rank K and 0 after it (hand values)", () => {
  assert.equal(ndcgAt(1, 10), 1); // 1 / log2(2)
  assert.equal(ndcgAt(3, 10), 0.5); // 1 / log2(4)
  assert.equal(ndcgAt(7, 10), 1 / 3); // 1 / log2(8)
  assert.equal(ndcgAt(15, 20), 0.25); // 1 / log2(16)
  assert.equal(ndcgAt(10, 10), 1 / Math.log2(11));
  assert.equal(ndcgAt(11, 10), 0);
  assert.equal(ndcgAt(100000, 20), 0);
});

test("ranks below 1 and non-integer ranks are errors", () => {
  assert.throws(() => recallAt(0, 10));
  assert.throws(() => ndcgAt(1.5, 10));
  assert.throws(() => ndcgAt(-1, 10));
});

test("f6 prints 6 decimals and never a negative zero", () => {
  assert.equal(f6(1), "1.000000");
  assert.equal(f6(1 / 3), "0.333333");
  assert.equal(f6(-0.0000001), "0.000000");
  assert.equal(f6(0.5), "0.500000");
  assert.equal(f6(-0.25), "-0.250000");
});

// Four users. Buckets: 0 -> users 1 and 2, 1-4 -> user 3, 5-19 -> user 4.
const rows: RankRow[] = [
  { userId: 3, bucket: "1-4", rank: 7 }, // given out of order on purpose
  { userId: 1, bucket: "0", rank: 1 },
  { userId: 4, bucket: "5-19", rank: 15 },
  { userId: 2, bucket: "0", rank: 3 },
];

test("GROUPS lists each bucket, 0-4 after its parts, and all last", () => {
  assert.deepEqual([...GROUPS], ["0", "1-4", "0-4", "5-19", "20+", "all"]);
});

test("summarize gives one row per K and group, with means over the group's users", () => {
  const out = summarize("d", "validation", "BL2", rows, [5, 10, 20]);
  assert.equal(out.length, 3 * GROUPS.length);
  const get = (k: number, bucket: string) => out.find((r) => r.k === k && r.bucket === bucket)!;
  // K = 10: ranks 1, 3, 7 hit; rank 15 does not.
  const all10 = get(10, "all");
  assert.equal(all10.nUsers, 4);
  assert.equal(all10.recall, "0.750000");
  // (1 + 0.5 + 1/3 + 0) / 4 = 0.458333...
  assert.equal(all10.ndcg, "0.458333");
  // bucket 0 has users 1 (rank 1) and 2 (rank 3): ndcg (1 + 0.5) / 2.
  assert.equal(get(10, "0").nUsers, 2);
  assert.equal(get(10, "0").ndcg, "0.750000");
  // 0-4 is 0 plus 1-4: users 1, 2, 3.
  const z = get(10, "0-4");
  assert.equal(z.nUsers, 3);
  assert.equal(z.recall, "1.000000");
  assert.equal(z.ndcg, "0.611111"); // (1 + 0.5 + 1/3) / 3
  // K = 5: rank 7 no longer hits.
  assert.equal(get(5, "1-4").recall, "0.000000");
  assert.equal(get(5, "all").recall, "0.500000");
  // K = 20: rank 15 hits, with 0.25.
  assert.equal(get(20, "5-19").ndcg, "0.250000");
  // A group with no users has n_users 0 and empty metrics.
  const empty = get(10, "20+");
  assert.equal(empty.nUsers, 0);
  assert.equal(empty.recall, "");
  assert.equal(empty.ndcg, "");
  assert.equal(empty.method, "BL2");
  assert.equal(empty.dataset, "d");
  assert.equal(empty.split, "validation");
});

test("summarize does not depend on the input order (sums run in user_id order)", () => {
  // Values that make a float sum depend on its order.
  const many: RankRow[] = [];
  for (let u = 1; u <= 200; u++) many.push({ userId: u, bucket: u % 2 ? "0" : "5-19", rank: 1 + ((u * 7919) % 25) });
  const a = summarize("d", "validation", "BL1", many, [10]);
  const b = summarize("d", "validation", "BL1", [...many].reverse(), [10]);
  const c = summarize("d", "validation", "BL1", [...many].sort((x, y) => ((x.userId * 31) % 17) - ((y.userId * 31) % 17) || x.userId - y.userId), [10]);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
});

test("summarize rejects an unknown bucket", () => {
  assert.throws(() => summarize("d", "validation", "BL1", [{ userId: 1, bucket: "7-9", rank: 1 }], [10]), /bucket/);
});

test("coverage: distinct posts in any top-K list over distinct posts in any pool, per method and K", () => {
  const cov = new CoverageTracker([5, 10]);
  // Two users with pools of 6 posts each; the pools overlap: union is 8 posts (1..8).
  cov.addPool([1, 2, 3, 4, 5, 6]);
  cov.addPool([3, 4, 5, 6, 7, 8]);
  // Method A: user 1 top list 1,2,3,4,5,6 ; user 2 top list 3,4,5,6,7,8 (K = 5 takes the first 5, K = 10 the whole list)
  cov.addTop("A", [1, 2, 3, 4, 5, 6]);
  cov.addTop("A", [3, 4, 5, 6, 7, 8]);
  // Method B: both users get the same list 8,7,6,5,4,3.
  cov.addTop("B", [8, 7, 6, 5, 4, 3]);
  cov.addTop("B", [8, 7, 6, 5, 4, 3]);
  const out = cov.rows("d", "validation", ["A", "B"]);
  const get = (m: string, k: number) => out.find((r) => r.method === m && r.k === k)!;
  // A at K = 5: {1..5} U {3..7} = {1..7} -> 7 / 8.
  assert.equal(get("A", 5).coverage, "0.875000");
  // A at K = 10: all 8.
  assert.equal(get("A", 10).coverage, "1.000000");
  // B at K = 5: {8,7,6,5,4} -> 5 / 8.
  assert.equal(get("B", 5).coverage, "0.625000");
  // B at K = 10: {3..8} -> 6 / 8.
  assert.equal(get("B", 10).coverage, "0.750000");
  assert.deepEqual(
    out.map((r) => `${r.method}${r.k}`),
    ["A5", "A10", "B5", "B10"],
  );
});

test("coverage with no pool posts is n/a (empty), not a division by zero", () => {
  const cov = new CoverageTracker([5]);
  assert.equal(cov.rows("d", "validation", ["A"])[0]!.coverage, "");
});
