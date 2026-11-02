import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPool } from "@breadit/ranking";
import type { Post } from "@breadit/ranking";
import { buildIndex, inPool, poolSize } from "./buckets.ts";
import { rng } from "../rng.ts";
import { loadFrozen } from "../frozen.ts";

// DW5: the shared buildPool (packages/ranking) agrees with the P3 pool rule (inPool and poolSize in buckets.ts)
// on random fixtures. The package is imported by name from this ES module, so the test also proves that the
// ES module side can load the CommonJS package built by tsc (design F4).

function userId(n: number): string {
  return `u${String(n).padStart(10, "0")}`;
}

test("buildPool agrees with inPool and poolSize on random fixtures", () => {
  const r = rng(loadFrozen().masterSeed, "bootstrap");
  const user = 1;
  let inCount = 0;
  let outCount = 0;
  let tieFixtures = 0;
  const rounds = 300;
  for (let round = 0; round < rounds; round++) {
    const windowSec = [50, 100, 150][r.int(3)] as number;
    const tu = 950 + r.int(101);
    const nPosts = 8 + r.int(25);
    const maxPosts = 1 + r.int(8);

    const created: Record<number, number> = {};
    const author: Record<number, number> = {};
    let hasTie = false;
    for (let s = 1; s <= nPosts; s++) {
      // 25% of the posts copy the createdAt of the previous post: ties on purpose
      if (s > 1 && r.float() < 0.25) {
        created[s] = created[s - 1] as number;
        hasTie = true;
      } else {
        created[s] = 800 + r.int(301);
      }
      author[s] = 1 + r.int(5);
    }
    if (hasTie) tieFixtures++;
    const own = new Set<number>();
    const earlier = new Set<number>();
    for (let s = 1; s <= nPosts; s++) {
      if (author[s] === user) own.add(s);
      if (r.float() < 0.15) earlier.add(s);
    }

    const candidates: Post[] = [];
    for (let s = 1; s <= nPosts; s++) {
      candidates.push({
        id: s,
        authorId: userId(author[s] as number),
        communityId: null,
        createdAt: created[s] as number,
        isApproved: true,
        deleted: false,
      });
    }
    // The candidate order must not matter: put it in a random order.
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = r.int(i + 1);
      [candidates[i], candidates[j]] = [candidates[j] as Post, candidates[i] as Post];
    }
    const asOf = r.float() < 0.5 ? { t: tu } : { t: tu, beforeEventId: r.int(100) };

    const pool = buildPool(
      { user: userId(user), asOf, candidates, blocked: new Set<string>(), earlierPositives: earlier },
      { windowSec, maxPosts },
    );
    const inPoolIds = new Set(pool.map((p) => p.id));
    const ix = buildIndex(created);

    assert.equal(pool.length, poolSize(tu, ix, own, earlier, windowSec, maxPosts), `pool size, round ${round}`);
    for (let s = 1; s <= nPosts; s++) {
      const expected = inPool(tu, s, ix, own, earlier, windowSec, maxPosts);
      assert.equal(inPoolIds.has(s), expected, `round ${round}, post ${s}`);
      if (expected) inCount++;
      else outCount++;
    }
  }
  // The fixtures are not trivial: both outcomes and ties happen.
  assert.ok(rounds >= 200);
  assert.ok(inCount > 500, `in-pool cases: ${inCount}`);
  assert.ok(outCount > 500, `out-of-pool cases: ${outCount}`);
  assert.ok(tieFixtures > 100, `fixtures with a createdAt tie: ${tieFixtures}`);
});
