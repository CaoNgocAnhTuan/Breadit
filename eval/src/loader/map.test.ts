import { test } from "node:test";
import assert from "node:assert/strict";
import { loadDataset } from "../canonical/dataset.ts";
import { SMALL, randomDataset } from "../harness/random-data.ts";
import type { DatasetTables } from "../harness/random-data.ts";
import { PASSWORD_HASH, appUserId, repostOffset } from "./ids.ts";
import { detectShift, fromAppRows, toAppRows } from "./map.ts";
import { toDate } from "./time.ts";

const GOLDEN = new URL("../harness/fixtures/golden", import.meta.url).pathname;
const golden: DatasetTables = loadDataset(GOLDEN);
// randomDataset builds its user ids with a formula that repeats id 11. A canonical dataset has unique user ids, so the repeat is dropped here.
function uniqueUsers(d: DatasetTables): DatasetTables {
  const seen = new Set<number>();
  return { ...d, users: d.users.filter((u) => (seen.has(u.userId) ? false : (seen.add(u.userId), true))) };
}
const random: DatasetTables = uniqueUsers(randomDataset(SMALL));
const REAL_EPOCH = 1767225600; // 2026-01-01T00:00:00Z, the epoch of the synthetic manifests
const SHIFT = 86400 * 300;

// The sort order of blueprint section 2.2, written out here on purpose (not taken from the code under test).
function by<T>(rows: readonly T[], ...keys: Array<(r: T) => number>): T[] {
  return [...rows].sort((a, b) => {
    for (const k of keys) {
      const d = k(a) - k(b);
      if (d !== 0) return d;
    }
    return 0;
  });
}

function canonicalOrder(d: DatasetTables): DatasetTables {
  return {
    users: by(d.users, (r) => r.userId),
    follows: by(d.follows, (r) => r.followerId, (r) => r.followeeId),
    communities: by(d.communities, (r) => r.communityId),
    memberships: by(d.memberships, (r) => r.userId, (r) => r.communityId),
    posts: by(d.posts, (r) => r.postId),
    interactions: by(d.interactions, (r) => r.createdAt, (r) => r.eventId),
  };
}

const cases: Array<[string, DatasetTables, number]> = [
  ["golden, epoch 0", golden, 0],
  ["golden, real epoch", golden, REAL_EPOCH],
  ["random, real epoch", random, REAL_EPOCH],
];

test("the golden fixture has 27 likes, 4 comments and 2 reposts (the test data is what the plan says)", () => {
  const n = (type: string): number => golden.interactions.filter((i) => i.type === type).length;
  assert.deepEqual([n("like"), n("comment"), n("repost")], [27, 4, 2]);
  const m = (type: string): number => random.interactions.filter((i) => i.type === type).length;
  assert.ok(m("like") > 0 && m("comment") > 0 && m("repost") > 0);
});

test("round trip: fromAppRows(toAppRows(d)) equals d, with shift 0 and a nonzero shift", () => {
  for (const [name, d, epoch] of cases) {
    for (const shift of [0, SHIFT, -3600]) {
      // A negative shift needs every time to stay at or after the epoch, so it is only used where the epoch leaves room.
      if (shift < 0 && epoch === 0) continue;
      const back = fromAppRows(toAppRows(d, epoch, shift), epoch, shift);
      assert.deepEqual(back, canonicalOrder(d), `${name}, shift ${shift}`);
    }
  }
});

test("the output does not depend on the input row order", () => {
  const shuffled: DatasetTables = {
    users: [...random.users].reverse(),
    follows: [...random.follows].reverse(),
    communities: [...random.communities].reverse(),
    memberships: [...random.memberships].reverse(),
    posts: [...random.posts].reverse(),
    interactions: [...random.interactions].reverse(),
  };
  assert.deepEqual(toAppRows(shuffled, REAL_EPOCH, 5), toAppRows(random, REAL_EPOCH, 5));
});

test("two calls on the same input give deep-equal output", () => {
  for (const [, d, epoch] of cases) assert.deepEqual(toAppRows(d, epoch, SHIFT), toAppRows(d, epoch, SHIFT));
});

test("user ids and usernames are u plus 10 digits", () => {
  const r = toAppRows(random, REAL_EPOCH, 0);
  assert.deepEqual(
    r.users.map((u) => u.id),
    by(random.users, (u) => u.userId).map((u) => appUserId(u.userId)),
  );
  for (const u of r.users) {
    assert.match(u.id, /^u[0-9]{10}$/);
    assert.equal(u.username, u.id);
  }
  assert.equal(toAppRows(golden, 0, 0).users[0]?.id, "u0000000001");
});

test("post, community, like and comment ids are the CSV ids and event ids", () => {
  for (const [, d, epoch] of cases) {
    const r = toAppRows(d, epoch, 0);
    assert.deepEqual(r.posts.map((p) => p.id), by(d.posts, (p) => p.postId).map((p) => p.postId));
    assert.deepEqual(r.communities.map((c) => c.id), by(d.communities, (c) => c.communityId).map((c) => c.communityId));
    const ids = (type: string): number[] => by(d.interactions.filter((i) => i.type === type), (i) => i.eventId).map((i) => i.eventId);
    assert.deepEqual(r.likes.map((l) => l.id), ids("like"));
    assert.deepEqual(r.comments.map((c) => c.id), ids("comment"));
  }
});

test("every repost id is the largest post id plus its event id, above every post id, and unique", () => {
  for (const [name, d, epoch] of cases) {
    const r = toAppRows(d, epoch, 0);
    const R = repostOffset(d.posts);
    const events = by(d.interactions.filter((i) => i.type === "repost"), (i) => i.eventId);
    assert.ok(events.length > 0, name);
    assert.deepEqual(r.reposts.map((p) => p.id), events.map((e) => R + e.eventId), name);
    const maxPost = Math.max(...r.posts.map((p) => p.id));
    for (const p of r.reposts) assert.ok(p.id > maxPost, `${name}: repost ${p.id} is above the largest post ${maxPost}`);
    const all = [...r.posts, ...r.reposts].map((p) => p.id);
    assert.equal(new Set(all).size, all.length, `${name}: post ids are unique`);
  }
});

test("a repost row points at the reposted post, has no text and no community, and belongs to the reposter", () => {
  const r = toAppRows(golden, 0, 0);
  const events = by(golden.interactions.filter((i) => i.type === "repost"), (i) => i.eventId);
  assert.equal(r.reposts.length, 2);
  r.reposts.forEach((p, i) => {
    const e = events[i]!;
    assert.equal(p.rePostId, e.postId);
    assert.equal(p.desc, null);
    assert.equal(p.communityId, null);
    assert.equal(p.userId, appUserId(e.userId));
    assert.equal(p.isApproved, true);
    assert.equal(p.deletedAt, null);
    assert.deepEqual(p.createdAt, toDate(0, e.createdAt, 0));
  });
  for (const p of r.posts) assert.equal(p.rePostId, null);
});

test("Follow and CommunityMember ids are 1..n in canonical sort order", () => {
  for (const [, d, epoch] of cases) {
    const r = toAppRows(d, epoch, 0);
    assert.deepEqual(r.follows.map((f) => f.id), r.follows.map((_, i) => i + 1));
    assert.deepEqual(r.members.map((m) => m.id), r.members.map((_, i) => i + 1));
    const f = by(d.follows, (x) => x.followerId, (x) => x.followeeId);
    assert.deepEqual(r.follows.map((x) => [x.followerId, x.followingId]), f.map((x) => [appUserId(x.followerId), appUserId(x.followeeId)]));
    const m = by(d.memberships, (x) => x.userId, (x) => x.communityId);
    assert.deepEqual(r.members.map((x) => [x.userId, x.communityId]), m.map((x) => [appUserId(x.userId), x.communityId]));
  }
});

test("fields that are not in the CSV are fixed or built from ids", () => {
  const e = REAL_EPOCH;
  const r = toAppRows(golden, e, SHIFT);
  const u = golden.users.find((x) => x.userId === 4)!;
  const at = toDate(e, u.joinedAt, SHIFT);
  assert.deepEqual(r.users.find((x) => x.id === "u0000000004"), {
    id: "u0000000004",
    email: "u0000000004@example.com",
    username: "u0000000004",
    displayName: "User 4",
    password: PASSWORD_HASH,
    emailVerified: at,
    createdAt: at,
    updatedAt: at,
  });
  for (const x of r.users) {
    assert.deepEqual(x.emailVerified, x.createdAt);
    assert.deepEqual(x.updatedAt, x.createdAt);
    assert.equal(x.password, PASSWORD_HASH);
  }
  for (const c of r.communities) {
    assert.equal(c.name, `Community ${c.id}`);
    assert.equal(c.slug, `c${c.id}`);
    assert.deepEqual(c.updatedAt, c.createdAt);
  }
  for (const m of r.members) assert.equal(m.role, "MEMBER");
  for (const p of r.posts) {
    assert.equal(p.desc, `Post ${p.id}`);
    assert.equal(p.isApproved, true);
    assert.equal(p.deletedAt, null);
    assert.deepEqual(p.updatedAt, p.createdAt);
  }
  for (const c of r.comments) {
    assert.equal(c.body, `Comment ${c.id}`);
    assert.equal(c.deletedAt, null);
    assert.deepEqual(c.updatedAt, c.createdAt);
  }
  for (const f of r.follows) assert.equal(f.notify, false);
});

test("a post in a community keeps its community id, and a post outside one has null", () => {
  const r = toAppRows(random, REAL_EPOCH, 0);
  const want = by(random.posts, (p) => p.postId).map((p) => p.communityId);
  assert.deepEqual(r.posts.map((p) => p.communityId), want);
  assert.ok(want.includes(null) && want.some((c) => c !== null));
});

test("every time is the epoch plus the CSV seconds plus the shift", () => {
  const r = toAppRows(golden, REAL_EPOCH, SHIFT);
  const like = golden.interactions.filter((i) => i.type === "like").sort((a, b) => a.eventId - b.eventId)[0]!;
  assert.deepEqual(r.likes[0]?.createdAt, toDate(REAL_EPOCH, like.createdAt, SHIFT));
  assert.equal(r.likes[0]?.createdAt.toISOString(), new Date((REAL_EPOCH + like.createdAt + SHIFT) * 1000).toISOString());
});

test("an event id below 1 is refused (a repost id would clash with a post id)", () => {
  const bad: DatasetTables = { ...golden, interactions: [{ eventId: 0, userId: 1, postId: 2, type: "repost", createdAt: 5 }] };
  assert.throws(() => toAppRows(bad, 0, 0), /event id/);
});

test("fromAppRows refuses a time that is not a whole second", () => {
  const r = toAppRows(golden, REAL_EPOCH, 0);
  const first = r.likes[0]!;
  const broken = { ...r, likes: [{ ...first, createdAt: new Date(first.createdAt.getTime() + 1) }, ...r.likes.slice(1)] };
  assert.throws(() => fromAppRows(broken, REAL_EPOCH, 0), /whole second/);
});

test("detectShift finds 0 for unshifted rows and the right value for shifted rows", () => {
  for (const [, d, epoch] of cases) {
    assert.equal(detectShift(toAppRows(d, epoch, 0), d, epoch), 0);
    assert.equal(detectShift(toAppRows(d, epoch, SHIFT), d, epoch), SHIFT);
  }
  assert.equal(detectShift(toAppRows(random, REAL_EPOCH, -3600), random, REAL_EPOCH), -3600);
});

test("detectShift on a database that lost its latest row finds a different shift, so load:check shows DIFF", () => {
  const late: DatasetTables = {
    ...golden,
    interactions: [...golden.interactions, { eventId: 99, userId: 8, postId: 2, type: "like", createdAt: 10_000_000 }],
  };
  const r = toAppRows(late, 0, 0);
  assert.equal(detectShift(r, late, 0), 0);
  const lost = { ...r, likes: r.likes.filter((l) => l.id !== 99) };
  assert.notEqual(detectShift(lost, late, 0), 0);
});
