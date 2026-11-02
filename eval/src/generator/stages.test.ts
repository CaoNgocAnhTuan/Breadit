import { test } from "node:test";
import assert from "node:assert/strict";
import { loadConfig, makeParams } from "./config.ts";
import type { GenParams } from "./config.ts";
import { genUsers } from "./users.ts";
import { genFollows } from "./follows.ts";
import { genCommunities } from "./communities.ts";
import { genPosts } from "./posts.ts";
import { genInteractions } from "./interactions.ts";
import { loadFrozen } from "../frozen.ts";
import { rng } from "../rng.ts";

const frozen = loadFrozen();
const config = loadConfig();

function params(over: Partial<GenParams> = {}, world: "W0" | "W1" | "W2M" = "W2M"): GenParams {
  return { ...makeParams(config, frozen, world, "S"), nUsers: 30, nPosts: 120, ...over };
}

function stages(p: GenParams) {
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  const follows = genFollows(rng(frozen.masterSeed, "follows"), p, users);
  const { communities, memberships } = genCommunities(rng(frozen.masterSeed, "communities"), p, users);
  const posts = genPosts(rng(frozen.masterSeed, "posts"), p, users, memberships);
  const { interactions, skipped } = genInteractions(rng(frozen.masterSeed, "interactions"), p, users, follows, memberships, posts);
  return { users, follows, communities, memberships, posts, interactions, skipped };
}

// ---------------------------------------------------------------- users

test("users: ids 1..N, joined times in the time range, main topic in range", () => {
  const p = params({ nUsers: 400 });
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  assert.equal(users.length, 400);
  users.forEach((u, i) => {
    assert.equal(u.userId, i + 1);
    assert.ok(Number.isInteger(u.joinedAt) && u.joinedAt >= 0 && u.joinedAt < p.spanEnd);
    assert.ok(u.mainTopic >= 0 && u.mainTopic < p.topics);
    assert.ok(u.activityWeight >= 1 && u.popularity >= 1 && u.postingWeight >= 1);
  });
});

test("users: the late-joiner share is near the parameter and late joiners join inside the span", () => {
  const p = params({ nUsers: 2000 });
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  const late = users.filter((u) => u.joinedAt >= p.spanStart);
  assert.ok(Math.abs(late.length / 2000 - p.lateJoinerShare) < 0.03, `late share ${late.length / 2000}`);
  assert.ok(users.filter((u) => u.joinedAt < p.spanStart).length + late.length === 2000);
  for (const u of late) assert.ok(u.joinedAt < p.spanEnd - 86400);
});

test("users: same stream gives the same users", () => {
  const p = params();
  assert.deepEqual(genUsers(rng(frozen.masterSeed, "users"), p), genUsers(rng(frozen.masterSeed, "users"), p));
});

// ---------------------------------------------------------------- follows

test("follows: no self-link, no repeat, dated after both users joined", () => {
  const p = params({ nUsers: 300 });
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  const follows = genFollows(rng(frozen.masterSeed, "follows"), p, users);
  assert.ok(follows.length > 100);
  const seen = new Set<string>();
  for (const f of follows) {
    assert.notEqual(f.followerId, f.followeeId);
    const key = `${f.followerId}:${f.followeeId}`;
    assert.ok(!seen.has(key), `repeat ${key}`);
    seen.add(key);
    const a = users[f.followerId - 1]!;
    const b = users[f.followeeId - 1]!;
    assert.ok(f.createdAt >= Math.max(a.joinedAt, b.joinedAt));
    assert.ok(f.createdAt < p.spanEnd);
  }
});

test("follows: the list share is near the parameter when no link is returned", () => {
  const p = params({ nUsers: 600, twoWayShare: 0 });
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  const follows = genFollows(rng(frozen.masterSeed, "follows"), p, users);
  const holders = new Set(follows.map((f) => f.followerId));
  assert.ok(Math.abs(holders.size / 600 - p.followListShare) < 0.07, `holders ${holders.size / 600}`);
});

test("follows: the mean list length is the parameter when no link is returned", () => {
  const p = params({ nUsers: 600, twoWayShare: 0 });
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  const follows = genFollows(rng(frozen.masterSeed, "follows"), p, users);
  const per = new Map<number, number>();
  for (const f of follows) per.set(f.followerId, (per.get(f.followerId) ?? 0) + 1);
  const mean = follows.length / per.size;
  assert.ok(Math.abs(mean - p.followeesMean) / p.followeesMean < 0.05, `mean ${mean}`);
});

test("follows: a share of links is returned", () => {
  const p = params({ nUsers: 400, twoWayShare: 0.5 });
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  const follows = genFollows(rng(frozen.masterSeed, "follows"), p, users);
  const keys = new Set(follows.map((f) => `${f.followerId}:${f.followeeId}`));
  const mutual = follows.filter((f) => keys.has(`${f.followeeId}:${f.followerId}`)).length / follows.length;
  assert.ok(mutual > 0.4 && mutual < 0.8, `mutual ${mutual}`);
  const none = genFollows(rng(frozen.masterSeed, "follows"), { ...p, twoWayShare: 0 }, users);
  const k2 = new Set(none.map((f) => `${f.followerId}:${f.followeeId}`));
  const m2 = none.filter((f) => k2.has(`${f.followeeId}:${f.followerId}`)).length / none.length;
  assert.ok(m2 < 0.15, `mutual by chance ${m2}`);
});

test("follows: homophily 0 is no more similar than chance, homophily 0.7 is more similar", () => {
  const share = (h: number) => {
    const p = params({ nUsers: 800, twoWayShare: 0, homophily: h });
    const users = genUsers(rng(frozen.masterSeed, "users"), p);
    const follows = genFollows(rng(frozen.masterSeed, "follows"), p, users);
    return follows.filter((f) => users[f.followerId - 1]!.mainTopic === users[f.followeeId - 1]!.mainTopic).length / follows.length;
  };
  const h0 = share(0);
  const h7 = share(0.7);
  assert.ok(h0 < 0.1, `h0 ${h0}`);
  assert.ok(h7 > h0 * 1.5, `h7 ${h7} vs h0 ${h0}`);
});

// ---------------------------------------------------------------- communities

test("communities: one per topic, memberships after the user joined, no repeat", () => {
  const p = params({ nUsers: 500 });
  const users = genUsers(rng(frozen.masterSeed, "users"), p);
  const { communities, memberships } = genCommunities(rng(frozen.masterSeed, "communities"), p, users);
  assert.equal(communities.length, p.topics);
  communities.forEach((c, i) => assert.equal(c.communityId, i + 1));
  const seen = new Set<string>();
  const per = new Map<number, number>();
  for (const m of memberships) {
    const key = `${m.userId}:${m.communityId}`;
    assert.ok(!seen.has(key));
    seen.add(key);
    assert.ok(m.joinedAt >= users[m.userId - 1]!.joinedAt && m.joinedAt < p.spanEnd);
    assert.ok(m.communityId >= 1 && m.communityId <= p.topics);
    per.set(m.userId, (per.get(m.userId) ?? 0) + 1);
  }
  for (const c of per.values()) assert.ok(c >= 1 && c <= p.maxMembershipsPerUser);
  assert.ok(Math.abs(1 - per.size / 500 - p.noMembershipShare) < 0.07, `none ${1 - per.size / 500}`);
});

test("communities: a member is likelier to join a community of the main topic when homophily is high", () => {
  const share = (h: number) => {
    const p = params({ nUsers: 800, homophily: h });
    const users = genUsers(rng(frozen.masterSeed, "users"), p);
    const { memberships } = genCommunities(rng(frozen.masterSeed, "communities"), p, users);
    return memberships.filter((m) => users[m.userId - 1]!.mainTopic === m.communityId - 1).length / memberships.length;
  };
  assert.ok(share(0.7) > share(0) * 2);
});

// ---------------------------------------------------------------- posts

test("posts: ids follow (created_at, author_id, draw order), times in the span after the author joined", () => {
  const p = params({ nUsers: 200, nPosts: 1500 });
  const s = stages(p);
  assert.equal(s.posts.length, 1500);
  s.posts.forEach((x, i) => {
    assert.equal(x.postId, i + 1);
    const a = s.users[x.authorId - 1]!;
    assert.ok(x.createdAt >= Math.max(p.spanStart, a.joinedAt) && x.createdAt < p.spanEnd);
    if (i > 0) {
      const prev = s.posts[i - 1]!;
      assert.ok(
        prev.createdAt < x.createdAt || (prev.createdAt === x.createdAt && prev.authorId <= x.authorId),
        `order at ${i}`,
      );
    }
  });
});

test("posts: D1 holds (a community post's author is a member at created_at) and topics match", () => {
  const p = params({ nUsers: 200, nPosts: 1500 });
  const s = stages(p);
  const joined = new Map(s.memberships.map((m) => [`${m.userId}:${m.communityId}`, m.joinedAt]));
  let community = 0;
  for (const x of s.posts) {
    if (x.communityId === null) continue;
    community++;
    const since = joined.get(`${x.authorId}:${x.communityId}`);
    assert.ok(since !== undefined && since <= x.createdAt);
    assert.equal(x.topic, x.communityId - 1);
  }
  assert.ok(community > 0 && community / 1500 <= p.communityPostShare + 0.04, `community share ${community / 1500}`);
  for (const x of s.posts) assert.ok(x.topic >= 0 && x.topic < p.topics);
});

// ---------------------------------------------------------------- interactions

test("interactions: strictly after the post, never one's own, never repeated, ids in (created_at, id) order", () => {
  const p = params({ nUsers: 200, nPosts: 1500 });
  const s = stages(p);
  assert.ok(s.interactions.length > 500);
  const postById = new Map(s.posts.map((x) => [x.postId, x]));
  const seen = new Set<string>();
  let prev = { createdAt: -1, eventId: 0 };
  s.interactions.forEach((e, i) => {
    assert.equal(e.eventId, i + 1);
    const post = postById.get(e.postId)!;
    assert.ok(e.createdAt > post.createdAt);
    assert.notEqual(e.userId, post.authorId);
    assert.ok(e.createdAt >= s.users[e.userId - 1]!.joinedAt);
    const key = `${e.userId}:${e.postId}`;
    assert.ok(!seen.has(key));
    seen.add(key);
    assert.ok(e.createdAt > prev.createdAt || (e.createdAt === prev.createdAt && e.eventId > prev.eventId));
    prev = e;
    assert.ok(["like", "comment", "repost"].includes(e.type));
  });
});

test("interactions: with no follows and no memberships the influence has no effect", () => {
  const base = params({ nUsers: 150, nPosts: 1200 });
  const users = genUsers(rng(frozen.masterSeed, "users"), base);
  const posts = genPosts(rng(frozen.masterSeed, "posts"), base, users, []);
  const run = (g: number) =>
    genInteractions(rng(frozen.masterSeed, "interactions"), { ...base, influenceSocial: g, influenceCommunity: g }, users, [], [], posts);
  assert.deepEqual(run(0).interactions, run(8).interactions);
  assert.deepEqual(run(0).interactions, run(0.5).interactions);
});

test("interactions: influence changes the rows when there are follows", () => {
  const p = params({ nUsers: 150, nPosts: 1200 });
  const s = stages(p);
  const other = genInteractions(
    rng(frozen.masterSeed, "interactions"),
    { ...p, influenceSocial: 0, influenceCommunity: 0 },
    s.users, s.follows, s.memberships, s.posts,
  );
  assert.notDeepEqual(other.interactions, s.interactions);
});

test("interactions: the total is near mean x users, and the stage is deterministic", () => {
  const p = params({ nUsers: 150, nPosts: 1200 });
  const a = stages(p);
  const b = stages(p);
  assert.deepEqual(a.interactions, b.interactions);
  const target = Math.round(p.interactionsPerUserMean * p.nUsers);
  assert.equal(a.interactions.length + a.skipped, target);
});

test("a world changes only what its knobs change: W1 and W2M share users, follows, communities, posts", () => {
  const w1 = stages(params({}, "W1"));
  const w2 = stages(params({}, "W2M"));
  assert.deepEqual(w1.users, w2.users);
  assert.deepEqual(w1.follows, w2.follows);
  assert.deepEqual(w1.memberships, w2.memberships);
  assert.deepEqual(w1.posts, w2.posts);
  assert.notDeepEqual(w1.interactions, w2.interactions);
});
