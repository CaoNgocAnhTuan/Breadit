import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDataset } from "../canonical/dataset.ts";
import { loadFrozen } from "../frozen.ts";
import { poolSetting, prepare, rankAt } from "../harness/run.ts";
import { lastEventTime } from "../loader/time.ts";
import { bucketCounts, drawParityPairs } from "./sample.ts";

// TC14, the draw. A small quota on syn-W2M-S (the real run is 25 per bucket on syn-W2M-M).
const frozen = loadFrozen();
const data = loadDataset(new URL("../../data/syn-W2M-S", import.meta.url).pathname);
const prep = prepare("syn-W2M-S", data, "fast");
const OPTS = { n: 8, perBucket: 2, maxDraws: 200_000 };
const pairs = drawParityPairs(prep, data, OPTS);

test("two draws on the same data are equal", () => {
  assert.deepEqual(drawParityPairs(prep, data, OPTS), pairs);
});

test("another seed gives other pairs", () => {
  const other = drawParityPairs(prep, data, { ...OPTS, seed: frozen.masterSeed + 1 });
  assert.notDeepEqual(other, pairs);
});

test("every bucket quota is met and the pairs are numbered from 1", () => {
  assert.equal(pairs.length, OPTS.n);
  assert.deepEqual(bucketCounts(pairs), frozen.historyBuckets.map((b) => ({ bucket: b.label, n: OPTS.perBucket })));
  assert.deepEqual(pairs.map((p) => p.pair), pairs.map((_, i) => i + 1));
});

test("every pool is non-empty and its size is the size of the harness order", () => {
  for (const p of pairs) {
    assert.ok(p.poolSize > 0, `pair ${p.pair}`);
    const order = rankAt(prep, p.user, { t: p.asOf }, { label: "BL1", method: "BL1", params: {} }, "normal");
    assert.equal(order.length, p.poolSize);
  }
});

test("one pair per user, and every user joined before t", () => {
  assert.equal(new Set(pairs.map((p) => p.user)).size, pairs.length);
  const joined = new Map(data.users.map((u) => [u.userId, u.joinedAt]));
  for (const p of pairs) assert.ok((joined.get(p.user) as number) < p.asOf, `pair ${p.pair}`);
});

test("t is in [first post time + W, last event time]", () => {
  const first = Math.min(...data.posts.map((p) => p.createdAt));
  const lo = first + poolSetting("normal").windowSec;
  const hi = lastEventTime(data);
  for (const p of pairs) assert.ok(p.asOf >= lo && p.asOf <= hi, `pair ${p.pair}: ${p.asOf}`);
});

test("n_followees and n_communities count the distinct ones before t, and n_history the positives before t", () => {
  for (const p of pairs) {
    const fol = new Set(data.follows.filter((f) => f.followerId === p.user && f.createdAt < p.asOf).map((f) => f.followeeId));
    const com = new Set(data.memberships.filter((m) => m.userId === p.user && m.joinedAt < p.asOf).map((m) => m.communityId));
    const hist = data.interactions.filter((e) => e.userId === p.user && e.createdAt < p.asOf).length;
    assert.equal(p.nFollowees, fol.size, `pair ${p.pair} followees`);
    assert.equal(p.nCommunities, com.size, `pair ${p.pair} communities`);
    assert.equal(p.nHistory, hist, `pair ${p.pair} history`);
  }
});

test("an n that is not perBucket times the number of buckets is an error", () => {
  assert.throws(() => drawParityPairs(prep, data, { n: 7, perBucket: 2, maxDraws: 10 }), /perBucket/);
});

test("too few draws stop with an error that names the short bucket", () => {
  assert.throws(() => drawParityPairs(prep, data, { n: 8, perBucket: 2, maxDraws: 3 }), /bucket "/);
});
