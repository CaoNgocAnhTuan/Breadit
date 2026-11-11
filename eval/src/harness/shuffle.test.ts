import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffleWithinPosts } from "./shuffle.ts";
import { computeCutTime } from "./run.ts";
import { positiveEvents } from "./index-data.ts";
import { loadDataset } from "../canonical/dataset.ts";
import type { Dataset, Interaction } from "../canonical/dataset.ts";
import { loadFrozen } from "../frozen.ts";

// TC3 (design "Shuffle", F8, F9): the shuffle keeps each post's engagers and its engagement slots, changes only who is in
// which slot, and leaves T where it was.
const frozen = loadFrozen();
const SEED = frozen.masterSeed;

const DATASETS: [string, Dataset][] = [
  ["golden", loadDataset(new URL("./fixtures/golden", import.meta.url).pathname)],
  ["syn-W2M-S", loadDataset(new URL("../../data/syn-W2M-S", import.meta.url).pathname)],
];

function byPost(rows: readonly Interaction[]): Map<number, Interaction[]> {
  const m = new Map<number, Interaction[]>();
  for (const r of rows) {
    const l = m.get(r.postId);
    if (l) l.push(r);
    else m.set(r.postId, [r]);
  }
  for (const l of m.values()) l.sort((a, b) => a.createdAt - b.createdAt || a.eventId - b.eventId);
  return m;
}

for (const [name, data] of DATASETS) {
  test(`${name}: sorted by (createdAt, eventId), same slots, same engagers, same T`, () => {
    const before = data.interactions;
    const copy = before.map((r) => ({ ...r }));
    const out = shuffleWithinPosts(before, SEED);
    assert.deepEqual(before, copy, "the input is not changed");
    assert.equal(out.length, before.length);
    for (let i = 1; i < out.length; i++) {
      const a = out[i - 1] as Interaction;
      const b = out[i] as Interaction;
      assert.ok(a.createdAt < b.createdAt || (a.createdAt === b.createdAt && a.eventId < b.eventId), `row ${i} is out of order`);
    }
    const posts = byPost(before);
    const after = byPost(out);
    assert.deepEqual([...after.keys()].sort((a, b) => a - b), [...posts.keys()].sort((a, b) => a - b));
    for (const [postId, rows] of posts) {
      const now = after.get(postId) as Interaction[];
      // the exact list of (createdAt, eventId, type) slots
      assert.deepEqual(
        now.map((r) => [r.createdAt, r.eventId, r.type]),
        rows.map((r) => [r.createdAt, r.eventId, r.type]),
        `slots of post ${postId}`,
      );
      // the multiset of users
      assert.deepEqual(now.map((r) => r.userId).sort((a, b) => a - b), rows.map((r) => r.userId).sort((a, b) => a - b), `users of post ${postId}`);
    }
    // T comes from the same (t, id) pairs
    assert.equal(computeCutTime(positiveEvents({ interactions: out })), computeCutTime(positiveEvents({ interactions: before })));
  });

  test(`${name}: no author engages with their own post, no user touches a post twice, and two calls give equal output`, () => {
    const out = shuffleWithinPosts(data.interactions, SEED);
    const author = new Map(data.posts.map((p) => [p.postId, p.authorId]));
    const seen = new Set<string>();
    for (const r of out) {
      assert.notEqual(author.get(r.postId), r.userId, `author ${r.userId} on own post ${r.postId}`);
      const key = `${r.userId}:${r.postId}`;
      assert.ok(!seen.has(key), `user ${r.userId} touches post ${r.postId} twice`);
      seen.add(key);
    }
    assert.deepEqual(shuffleWithinPosts(data.interactions, SEED), out);
  });

  test(`${name}: at least one post with two or more engagers gets a different order of users, and another seed gives another shuffle`, () => {
    const out = shuffleWithinPosts(data.interactions, SEED);
    const before = byPost(data.interactions);
    const after = byPost(out);
    let changed = 0;
    let multi = 0;
    for (const [postId, rows] of before) {
      if (rows.length < 2) continue;
      multi++;
      const a = rows.map((r) => r.userId).join(",");
      const b = (after.get(postId) as Interaction[]).map((r) => r.userId).join(",");
      if (a !== b) changed++;
    }
    assert.ok(multi > 0, "the dataset has no post with two engagers");
    assert.ok(changed >= 1, "the shuffle changed no post");
    assert.notDeepEqual(shuffleWithinPosts(data.interactions, SEED + 1), out);
  });
}

test("syn-W2M-S: most multi-engager posts change, so the shuffle is not a near no-op", () => {
  const data = (DATASETS[1] as [string, Dataset])[1];
  const before = byPost(data.interactions);
  const after = byPost(shuffleWithinPosts(data.interactions, SEED));
  let multi = 0;
  let changed = 0;
  for (const [postId, rows] of before) {
    if (rows.length < 2) continue;
    multi++;
    if (rows.map((r) => r.userId).join(",") !== (after.get(postId) as Interaction[]).map((r) => r.userId).join(",")) changed++;
  }
  assert.ok(changed / multi > 0.5, `only ${changed} of ${multi} posts changed`);
});

test("an empty list gives an empty list, and a post with one engager is unchanged", () => {
  assert.deepEqual(shuffleWithinPosts([], SEED), []);
  const one: Interaction[] = [{ eventId: 5, userId: 3, postId: 9, type: "like", createdAt: 100 }];
  assert.deepEqual(shuffleWithinPosts(one, SEED), one);
});
