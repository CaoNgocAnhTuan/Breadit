import { test } from "node:test";
import assert from "node:assert/strict";
import {
  KEPT_THRESHOLD,
  bucketOf,
  bucketReport,
  cutTime,
  historyCount,
  inPool,
  poolSize,
  testItems,
  buildIndex,
  BUCKET_LABELS,
  BUCKETS_0_4,
} from "./buckets.ts";
import type { Event } from "./buckets.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { writeFixture } from "./fixture.ts";
import { rng } from "../rng.ts";
import { loadFrozen } from "../frozen.ts";

// Port of test_check_cut_time.py (P2) for canonical data. An event is { id, t, user, post }.
function makeEvents(n: number, user = 1, start = 0): Event[] {
  return Array.from({ length: n }, (_, i) => ({ id: start + i, t: 10 * (i + 1), user, post: 100 + i }));
}

test("cut time is the time at rank ceil(q n), with exact integer math", () => {
  const pos = makeEvents(10);
  assert.equal(cutTime(pos, "0.8"), 80);
  assert.equal(cutTime(pos, "0.7"), 70); // 0.7 * 10 is 7.000000000000001 in floats
  assert.equal(cutTime(pos, "0.9"), 90);
  assert.equal(cutTime(makeEvents(9), "0.8"), 80); // 7.2 rounds up to rank 8
  assert.equal(cutTime(pos, "1"), 100);
});

test("cut time rejects no events and a bad q", () => {
  assert.throws(() => cutTime([], "0.8"));
  assert.throws(() => cutTime(makeEvents(3), "0"));
  assert.throws(() => cutTime(makeEvents(3), "1.5"));
  assert.throws(() => cutTime(makeEvents(3), "abc"));
});

test("test items: event at T is validation, last event after T is the test item", () => {
  const pos: Event[] = [
    { id: 0, t: 10, user: 1, post: 1 },
    { id: 1, t: 20, user: 1, post: 2 },
    { id: 2, t: 30, user: 1, post: 3 },
    { id: 3, t: 40, user: 1, post: 4 },
    { id: 4, t: 20, user: 2, post: 5 },
    { id: 5, t: 25, user: 3, post: 6 },
  ];
  pos.sort((a, b) => a.t - b.t || a.id - b.id);
  const items = testItems(pos, 20);
  assert.deepEqual(items.get(1), { id: 3, t: 40, user: 1, post: 4 });
  assert.equal(items.has(2), false);
  assert.deepEqual(items.get(3), { id: 5, t: 25, user: 3, post: 6 });
});

test("a user with nothing after T has no test item", () => {
  assert.equal(testItems([{ id: 0, t: 5, user: 1, post: 1 }, { id: 1, t: 10, user: 1, post: 2 }], 10).size, 0);
});

test("time ties among the last events are broken by event id", () => {
  const pos: Event[] = [{ id: 0, t: 30, user: 1, post: 1 }, { id: 1, t: 30, user: 1, post: 2 }];
  assert.deepEqual(testItems(pos, 10).get(1), { id: 1, t: 30, user: 1, post: 2 });
});

test("history counts strictly earlier events, and equal time with a smaller id", () => {
  const testEv: Event = { id: 5, t: 100, user: 1, post: 9 };
  const events: Event[] = [
    { id: 0, t: 50, user: 1, post: 1 },
    { id: 1, t: 99, user: 1, post: 2 },
    { id: 3, t: 100, user: 1, post: 3 },
    { id: 4, t: 100, user: 1, post: 4 },
    { id: 6, t: 100, user: 1, post: 5 },
    { id: 7, t: 101, user: 1, post: 6 },
    testEv,
  ];
  assert.equal(historyCount(events, testEv), 4);
  assert.equal(historyCount([], { id: 0, t: 10, user: 1, post: 1 }), 0);
});

test("bucket edges and the union 0-4", () => {
  assert.equal(bucketOf(0), "0");
  assert.equal(bucketOf(1), "1-4");
  assert.equal(bucketOf(4), "1-4");
  assert.equal(bucketOf(5), "5-19");
  assert.equal(bucketOf(19), "5-19");
  assert.equal(bucketOf(20), "20+");
  assert.equal(bucketOf(500), "20+");
  assert.deepEqual([...BUCKET_LABELS], ["0", "1-4", "5-19", "20+"]);
  assert.deepEqual([...BUCKETS_0_4], ["0", "1-4"]);
  for (let n = 0; n < 40; n++) assert.equal(BUCKETS_0_4.includes(bucketOf(n)), n <= 4);
  assert.equal(KEPT_THRESHOLD, 100);
});

const W = 100;
const T_U = 1000;

function pool(test: number, created: Record<number, number>, o: { own?: number[]; earlier?: number[]; nMax?: number } = {}): boolean {
  return inPool(T_U, test, buildIndex(created), new Set(o.own ?? []), new Set(o.earlier ?? []), W, o.nMax ?? 10);
}

test("window edges", () => {
  const created = { 1: 900, 2: 899, 3: 1000, 4: 999 };
  assert.equal(pool(1, created), true); // exactly W before t_u: in
  assert.equal(pool(2, created), false); // one second earlier: out
  assert.equal(pool(3, created), false); // created at t_u: out
  assert.equal(pool(4, created), true);
});

test("own posts and earlier positives are out", () => {
  const created = { 1: 950, 2: 960, 3: 970 };
  assert.equal(pool(1, created, { own: [1] }), false);
  assert.equal(pool(2, created, { earlier: [2] }), false);
  assert.equal(pool(3, created, { own: [1], earlier: [2] }), true);
});

test("only the newest N_max are in, and excluded posts do not use up the cap", () => {
  const created = { 1: 910, 2: 920, 3: 930 };
  assert.equal(pool(1, created, { nMax: 2 }), false);
  assert.equal(pool(2, created, { nMax: 2 }), true);
  assert.equal(pool(3, created, { nMax: 2 }), true);
  assert.equal(pool(1, created, { own: [3], nMax: 2 }), true);
});

test("created_at ties go to the larger post id", () => {
  const created = { 4: 940, 5: 940 };
  assert.equal(pool(5, created, { nMax: 1 }), true);
  assert.equal(pool(4, created, { nMax: 1 }), false);
});

test("pool size", () => {
  const idx = buildIndex({ 1: 910, 2: 920, 3: 930, 4: 899, 5: 1000 });
  assert.equal(poolSize(T_U, idx, new Set(), new Set(), W, 10), 3);
  assert.equal(poolSize(T_U, idx, new Set([1]), new Set([2]), W, 10), 1);
  assert.equal(poolSize(T_U, idx, new Set(), new Set(), W, 2), 2);
});

test("inPool and poolSize match a brute force on random fixtures", () => {
  const r = rng(loadFrozen().masterSeed, "bootstrap");
  for (let round = 0; round < 200; round++) {
    const created: Record<number, number> = {};
    for (let s = 1; s < 25; s++) created[s] = 850 + r.int(201);
    const own = new Set<number>();
    const earlier = new Set<number>();
    for (let s = 1; s < 25; s++) {
      if (r.float() < 0.15) own.add(s);
      if (r.float() < 0.15) earlier.add(s);
    }
    const nMax = 1 + r.int(8);
    const idx = buildIndex(created);
    const eligible = Object.keys(created)
      .map(Number)
      .filter((s) => T_U - W <= created[s]! && created[s]! < T_U && !own.has(s) && !earlier.has(s))
      .sort((a, b) => created[b]! - created[a]! || b - a)
      .slice(0, nMax);
    assert.equal(poolSize(T_U, idx, own, earlier, W, nMax), eligible.length);
    for (const s of Object.keys(created).map(Number)) {
      if (own.has(s) || earlier.has(s)) continue;
      assert.equal(inPool(T_U, s, idx, own, earlier, W, nMax), eligible.includes(s));
    }
  }
});

// The TC11 fixture of the P2 script: stories 1 and 2 are authored by users 1 and 2.
function reportFixture() {
  const users = [1, 2, 3, 4, 5, 6].map((u) => ({ user_id: u, joined_at: 0 }));
  const posts = [
    { post_id: 1, author_id: 1, community_id: null, created_at: 1000 },
    { post_id: 2, author_id: 2, community_id: null, created_at: 1010 },
  ];
  const votes: Array<[number, number, number]> = [
    [1020, 3, 1], [1030, 4, 1], [1040, 3, 2], [1050, 4, 2],
    [1060, 5, 1], [1070, 5, 2], [1080, 6, 1], [1090, 6, 2],
  ];
  const interactions = votes.map(([t, u, p], i) => ({ event_id: i + 1, user_id: u, post_id: p, type: "like", created_at: t }));
  const follows = [{ follower_id: 6, followee_id: 1, created_at: 500 }];
  return loadDataset(writeFixture({ users, posts, interactions, follows }));
}

test("bucketReport on the P2 fixture gives the same numbers as check_cut_time.py", () => {
  const rep = bucketReport(reportFixture(), "0.8", 100, 10);
  assert.equal(rep.n, 8);
  assert.equal(rep.cutTime, 1080);
  assert.equal(rep.testUsers, 1);
  assert.equal(rep.poolAtTWindow, 2);
  assert.equal(rep.poolMedian, 1);
  const row = (b: string) => rep.rows.find((r) => r.bucket === b)!;
  assert.deepEqual(rep.rows.map((r) => r.bucket), ["0", "1-4", "0-4", "5-19", "20+"]);
  assert.deepEqual(row("1-4"), { bucket: "1-4", testUsers: 1, kept: 1, leftOut: 0, keptWithFollowee: 1 });
  assert.deepEqual(row("0-4"), { bucket: "0-4", testUsers: 1, kept: 1, leftOut: 0, keptWithFollowee: 1 });
  assert.equal(row("0").testUsers, 0);
  assert.equal(rep.kept04, 1);
  assert.equal(rep.meetsThreshold, false);
  assert.equal(bucketReport(reportFixture(), "0.7", 100, 10).cutTime, 1070);
});

test("bucketReport is deterministic", () => {
  assert.deepEqual(bucketReport(reportFixture(), "0.8", 100, 10), bucketReport(reportFixture(), "0.8", 100, 10));
});
