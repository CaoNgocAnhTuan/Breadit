import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDataIndex, followeeEngagement, positiveEvents, uid, userEventCount, userNum, windowCandidates } from "./index-data.ts";
import { randomDataset, SMALL } from "./random-data.ts";
import { historyCount } from "../checks/buckets.ts";
import type { Event } from "../checks/buckets.ts";

test("user ids are u plus 10 digits and sort like the integers (blueprint 2.5)", () => {
  assert.equal(uid(42), "u0000000042");
  assert.equal(userNum("u0000000042"), 42);
  assert.ok(uid(9) < uid(10));
  assert.ok(uid(336225) > uid(99999));
  assert.throws(() => userNum("x42"));
});

test("history counts equal historyCount of buckets.ts, with ties broken by event id", () => {
  const data = randomDataset(SMALL);
  const idx = buildDataIndex("r", data);
  const pos = positiveEvents(data);
  const byUser = new Map<number, Event[]>();
  for (const e of pos) byUser.set(e.user, [...(byUser.get(e.user) ?? []), e]);
  let checked = 0;
  for (const e of pos) {
    assert.equal(userEventCount(idx, e.user, { t: e.t, beforeEventId: e.id }), historyCount(byUser.get(e.user) as Event[], e));
    checked++;
  }
  assert.ok(checked > 50);
});

test("positiveEvents are sorted by (t, id) and the index accepts unsorted input", () => {
  const data = randomDataset(SMALL);
  const shuffled = { ...data, interactions: [...data.interactions].reverse() };
  const a = positiveEvents(data);
  const b = positiveEvents(shuffled);
  assert.deepEqual(a, b);
  for (let i = 1; i < a.length; i++) {
    const p = a[i - 1] as Event;
    const q = a[i] as Event;
    assert.ok(p.t < q.t || (p.t === q.t && p.id < q.id));
  }
  assert.deepEqual(buildDataIndex("r", data).posts, buildDataIndex("r", shuffled).posts);
});

test("windowCandidates gives the posts with t - W <= createdAt < t, sorted by (createdAt, id)", () => {
  const data = randomDataset(SMALL);
  const idx = buildDataIndex("r", data);
  for (const [t, w] of [[30, 10], [0, 5], [60, 60], [61, 100], [25, 0]] as const) {
    const got = windowCandidates(idx, t, w).map((p) => p.id);
    const want = data.posts
      .filter((p) => t - w <= p.createdAt && p.createdAt < t)
      .sort((a, b) => a.createdAt - b.createdAt || a.postId - b.postId)
      .map((p) => p.postId);
    assert.deepEqual(got, want, `t ${t} w ${w}`);
  }
});

test("followeeEngagement lists, per post, the followees with a visible positive, sorted and distinct", () => {
  const data = randomDataset({ ...SMALL, repeats: true, interactions: 300 });
  const idx = buildDataIndex("r", data);
  const followees = [...new Set(data.follows.map((f) => f.followeeId))].sort((a, b) => a - b).map(uid);
  const asOf = { t: 30, beforeEventId: 120 };
  const got = followeeEngagement(idx, followees, asOf);
  const want = new Map<number, string[]>();
  for (const f of followees) {
    for (const e of data.interactions) {
      if (uid(e.userId) !== f) continue;
      const visible = e.createdAt < asOf.t || (e.createdAt === asOf.t && e.eventId < asOf.beforeEventId);
      if (!visible) continue;
      const l = want.get(e.postId) ?? [];
      if (!l.includes(f)) l.push(f);
      want.set(e.postId, l);
    }
  }
  assert.deepEqual(
    [...got.entries()].sort((a, b) => a[0] - b[0]),
    [...want.entries()].sort((a, b) => a[0] - b[0]),
  );
  for (const l of got.values()) assert.deepEqual(l, [...l].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
});
