import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketOf, cutTime, historyCount, splitItems, testItems, validationItems } from "./split.ts";
import type { Event } from "../checks/buckets.ts";
import * as buckets from "../checks/buckets.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { loadFrozen } from "../frozen.ts";

// The T rule exists once, in checks/buckets.ts. split.ts re-exports it and adds the validation item (TC6, part 1).
function sorted(events: Event[]): Event[] {
  return [...events].sort((a, b) => a.t - b.t || a.id - b.id);
}

test("split.ts re-exports the T rule of buckets.ts, it does not copy it", () => {
  assert.equal(cutTime, buckets.cutTime);
  assert.equal(testItems, buckets.testItems);
  assert.equal(historyCount, buckets.historyCount);
  assert.equal(bucketOf, buckets.bucketOf);
});

test("validation item: the last positive with t <= T, and an event at exactly T is validation", () => {
  const pos = sorted([
    { id: 0, t: 10, user: 1, post: 1 },
    { id: 1, t: 20, user: 1, post: 2 },
    { id: 2, t: 30, user: 1, post: 3 },
    { id: 3, t: 40, user: 1, post: 4 },
    { id: 4, t: 20, user: 2, post: 5 },
    { id: 5, t: 25, user: 3, post: 6 },
  ]);
  const v = validationItems(pos, 20);
  assert.deepEqual(v.get(1), { id: 1, t: 20, user: 1, post: 2 }); // t = T counts
  assert.deepEqual(v.get(2), { id: 4, t: 20, user: 2, post: 5 });
  assert.equal(v.has(3), false); // only an event after T: no validation item
  assert.deepEqual(testItems(pos, 20).get(1), { id: 3, t: 40, user: 1, post: 4 });
});

test("validation item: ties in time go to the larger event id", () => {
  const pos = sorted([
    { id: 7, t: 15, user: 1, post: 1 },
    { id: 9, t: 15, user: 1, post: 2 },
    { id: 8, t: 15, user: 1, post: 3 },
  ]);
  assert.deepEqual(validationItems(pos, 20).get(1), { id: 9, t: 15, user: 1, post: 2 });
});

test("a user has at most one item per split, and the two never share an event", () => {
  const pos = sorted([
    { id: 0, t: 5, user: 1, post: 1 },
    { id: 1, t: 50, user: 1, post: 2 },
    { id: 2, t: 6, user: 2, post: 3 },
  ]);
  const v = validationItems(pos, 10);
  const t = testItems(pos, 10);
  assert.deepEqual([...v.keys()].sort((a, b) => a - b), [1, 2]);
  assert.deepEqual([...t.keys()], [1]);
  assert.notEqual((v.get(1) as Event).id, (t.get(1) as Event).id);
});

test("splitItems picks validation or test, and refuses another name", () => {
  const pos = sorted([{ id: 0, t: 5, user: 1, post: 1 }, { id: 1, t: 50, user: 1, post: 2 }]);
  assert.equal(splitItems(pos, 10, "validation").get(1)?.id, 0);
  assert.equal(splitItems(pos, 10, "test").get(1)?.id, 1);
  assert.throws(() => splitItems(pos, 10, "dev" as "test"), /split/);
});

// On syn-W2M-S (DW6 part): the harness items equal an independent brute-force rule, and test items equal buckets.ts.
const dir = new URL("../../data/syn-W2M-S", import.meta.url).pathname;

test("on syn-W2M-S the items equal a brute-force rule and respect T", () => {
  const data = loadDataset(dir);
  const pos = sorted(data.interactions.map((e) => ({ id: e.eventId, t: e.createdAt, user: e.userId, post: e.postId })));
  const T = loadFrozen().cutTimes["syn-W2M-S"] as number;
  assert.equal(cutTime(pos, String(loadFrozen().cutQuantile)), T);
  const val = splitItems(pos, T, "validation");
  const test_ = splitItems(pos, T, "test");
  assert.ok(val.size > 100 && test_.size > 100);
  const users = [...new Set(pos.map((e) => e.user))].sort((a, b) => a - b);
  for (const u of users) {
    const mine = pos.filter((e) => e.user === u);
    const beforeT = mine.filter((e) => e.t <= T);
    const afterT = mine.filter((e) => e.t > T);
    assert.equal(val.get(u)?.id, beforeT.length ? beforeT[beforeT.length - 1]!.id : undefined);
    assert.equal(test_.get(u)?.id, afterT.length ? afterT[afterT.length - 1]!.id : undefined);
  }
  for (const e of val.values()) assert.ok(e.t <= T);
  for (const e of test_.values()) assert.ok(e.t > T);
  assert.deepEqual(test_, testItems(pos, T));
});
