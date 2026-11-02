import { test } from "node:test";
import assert from "node:assert/strict";
import { postFeaturesAsOf, scorer, userFeaturesAsOf } from "@breadit/ranking";
import type { AsOf, MethodId, Positive } from "@breadit/ranking";
import { buildDataIndex, followeeEngagement, uid, windowCandidates } from "./index-data.ts";
import type { DataIndex } from "./index-data.ts";
import { fastPostFeatures, referencePositives, userFeatureData } from "./post-features.ts";
import { randomDataset, SMALL } from "./random-data.ts";
import type { DatasetTables, RandomOptions } from "./random-data.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { rng } from "../rng.ts";

// TC9 / design F3: the fast post features give the same scores as postFeaturesAsOf of the package.
const METHODS: MethodId[] = ["BL0", "BL1", "BL2", "BL2t", "BL3", "BL4", "BL5", "BL6", "H", "H-follow", "H-comm", "H-noauthor", "H-noengager"];
const PARAMS = { m: 5, alpha: 2, beta: 4, ageWeight: 0.5, divisor: 45000, gravity: 1.8 };

function compareAll(data: DatasetTables, idx: DataIndex, asOfs: Array<{ user: number; asOf: AsOf }>): number {
  const all: Positive[] = referencePositives(data);
  let posts = 0;
  for (const { user, asOf } of asOfs) {
    const u = uid(user);
    const uf = userFeaturesAsOf(u, asOf, userFeatureData(idx, user));
    const engaged = followeeEngagement(idx, uf.followees, asOf);
    const followees = new Set(uf.followees);
    // Posts created before asOf.t, like the pool: a post from the future has a negative age.
    for (const post of windowCandidates(idx, asOf.t, Number.MAX_SAFE_INTEGER)) {
      const fast = fastPostFeatures(post, asOf, engaged, idx);
      const ref = postFeaturesAsOf(post, asOf, all);
      assert.equal(fast.likes, ref.likes, `likes of post ${post.id}`);
      assert.equal(fast.comments, ref.comments, `comments of post ${post.id}`);
      assert.equal(fast.reposts, ref.reposts, `reposts of post ${post.id}`);
      assert.equal(fast.createdAt, ref.createdAt);
      // Only the followees among the engagers are kept: the scorers read nothing else (design "One fast path").
      assert.deepEqual(fast.engagedBy, ref.engagedBy.filter((x) => followees.has(x)), `engagedBy of post ${post.id}`);
      for (const method of METHODS) {
        const ctx = { user: u, asOf, uf, params: PARAMS };
        assert.equal(scorer(method)(ctx, post, fast), scorer(method)(ctx, post, ref), `${method} on post ${post.id}`);
      }
      posts++;
    }
  }
  return posts;
}

test("fast and reference post features give the same counts and scores on random datasets", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const o: RandomOptions = { ...SMALL, seed, repeats: seed % 2 === 0, interactions: 200 };
    const data = randomDataset(o);
    const idx = buildDataIndex("r", data);
    const g = rng(seed, "parity");
    const asOfs: Array<{ user: number; asOf: AsOf }> = [];
    for (let i = 0; i < 40; i++) {
      const user = (data.users[g.int(data.users.length)] as { userId: number }).userId;
      const ev = data.interactions[g.int(data.interactions.length)] as { createdAt: number; eventId: number };
      // Three kinds of asOf: at an event (with its id), at a time with no id, and at an event's time with a random id.
      const kind = i % 3;
      asOfs.push({
        user,
        asOf: kind === 0 ? { t: ev.createdAt, beforeEventId: ev.eventId } : kind === 1 ? { t: ev.createdAt } : { t: g.int(61), beforeEventId: 1 + g.int(210) },
      });
    }
    const n = compareAll(data, idx, asOfs);
    assert.ok(n > 100, `seed ${seed}: only ${n} posts compared`);
  }
});

test("fast and reference post features give the same scores on syn-W2M-S", () => {
  const data = loadDataset(new URL("../../data/syn-W2M-S", import.meta.url).pathname);
  const idx = buildDataIndex("syn-W2M-S", data);
  const g = rng(11, "parity");
  const asOfs: Array<{ user: number; asOf: AsOf }> = [];
  for (let i = 0; i < 12; i++) {
    const ev = data.interactions[g.int(data.interactions.length)] as { userId: number; createdAt: number; eventId: number };
    asOfs.push({ user: ev.userId, asOf: { t: ev.createdAt, beforeEventId: ev.eventId } });
  }
  const n = compareAll(data, idx, asOfs);
  assert.ok(n > 1000, `only ${n} posts compared`);
});
