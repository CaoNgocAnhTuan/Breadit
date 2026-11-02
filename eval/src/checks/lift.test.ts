import { test } from "node:test";
import assert from "node:assert/strict";
import { computeLift } from "./lift.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { writeFixture } from "./fixture.ts";
import type { FixtureTables } from "./fixture.ts";

const W = 1000;
const users = [1, 2, 3].map((u) => ({ user_id: u, joined_at: 0 }));
const posts = [
  { post_id: 1, author_id: 1, community_id: null, created_at: 100 },
  { post_id: 2, author_id: 3, community_id: null, created_at: 100 },
  { post_id: 3, author_id: 3, community_id: null, created_at: 100 },
  { post_id: 4, author_id: 1, community_id: null, created_at: 105 },
];

function lift(t: FixtureTables) {
  return computeLift(loadDataset(writeFixture({ users, posts, ...t })), W);
}

test("every action on an exposed post gives a lift above 1", () => {
  const r = lift({
    follows: [{ follower_id: 2, followee_id: 1, created_at: 10 }],
    interactions: [
      { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 200 },
      { event_id: 2, user_id: 2, post_id: 4, type: "like", created_at: 210 },
    ],
  });
  assert.equal(r.actions, 2);
  assert.equal(r.exposedActions, 2);
  assert.ok(r.lift !== null && r.lift > 1);
  // hits 2 / (2/4 + 1/3) = 2.4
  assert.ok(Math.abs(r.lift! - 2.4) < 1e-9);
});

test("with no follows the lift is not computed and the report says so", () => {
  const r = lift({ interactions: [{ event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 200 }] });
  assert.equal(r.lift, null);
  assert.match(r.note, /no follows/);
});

test("a follow dated at or after the action does not count", () => {
  const r = lift({
    follows: [
      { follower_id: 2, followee_id: 1, created_at: 200 }, // same second as the action: does not count
      { follower_id: 3, followee_id: 1, created_at: 10 }, // counts
    ],
    interactions: [
      { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 200 },
      { event_id: 2, user_id: 3, post_id: 1, type: "like", created_at: 300 },
    ],
  });
  assert.equal(r.actions, 2);
  assert.equal(r.exposedActions, 1);
});

test("a post a followee acted on before is exposed", () => {
  const r = lift({
    follows: [{ follower_id: 3, followee_id: 2, created_at: 10 }],
    interactions: [
      { event_id: 1, user_id: 2, post_id: 1, type: "like", created_at: 150 },
      { event_id: 2, user_id: 3, post_id: 1, type: "like", created_at: 200 },
    ],
  });
  // user 3 is the author of posts 2 and 3 only, so post 1 is a candidate for user 3
  assert.equal(r.exposedActions, 1);
  assert.ok(r.lift !== null && r.lift > 1);
});

test("an action by the followee after the follower's action does not expose it", () => {
  const r = lift({
    follows: [{ follower_id: 3, followee_id: 2, created_at: 10 }],
    interactions: [
      { event_id: 1, user_id: 3, post_id: 1, type: "like", created_at: 150 },
      { event_id: 2, user_id: 2, post_id: 1, type: "like", created_at: 200 },
    ],
  });
  assert.equal(r.exposedActions, 0);
});
