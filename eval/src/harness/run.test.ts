import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { countItems, poolSetting, runConfig, runDataset } from "./run.ts";
import type { DatasetRun, PerUserRow, RunParams } from "./run.ts";
import { resultTexts } from "./write.ts";
import { fixedVariants } from "./config.ts";
import type { RunConfig } from "./config.ts";
import { positiveEvents } from "./index-data.ts";
import { splitItems } from "./split.ts";
import type { Event, SplitName } from "./split.ts";
import { randomDataset, SMALL } from "./random-data.ts";
import type { DatasetTables } from "./random-data.ts";
import { loadDataset } from "../canonical/dataset.ts";
import { bucketReport } from "../checks/buckets.ts";
import { loadFrozen } from "../frozen.ts";
import { METHOD_ORDER, ndcgAt, recallAt, f6 } from "../metrics.ts";
import { rng } from "../rng.ts";

const frozen = loadFrozen();
const FIXTURES = new URL("./fixtures/", import.meta.url).pathname;
const GOLDEN = join(FIXTURES, "golden");
const DAY = 86400;

// The golden dataset (fixtures/golden): 9 users, 12 posts, 33 positives, times in hours x 3600. 33 positives: T is the
// time of the 27th, 187 h = 673200 s. The user with the 27th event (user 6) has it as a validation item (an event at T).
const GOLDEN_T = 673200;
const GOLDEN_CONFIG: RunConfig = {
  datasets: ["golden"],
  split: "validation",
  methods: [...METHOD_ORDER],
  params: {
    BL2t: { ageWeight: 0.5 },
    BL4: { divisor: 45000 },
    BL5: { gravity: 1.8 },
    BL6: { alpha: 2 },
    H: { alpha: 2, beta: 4, m: 5 },
    "H-follow": { alpha: 2, m: 5 },
    "H-comm": { beta: 4, m: 5 },
    "H-noauthor": { alpha: 2, beta: 4, m: 5 },
    "H-noengager": { alpha: 2, beta: 4, m: 5 },
  },
  pool: "normal",
  mode: "fast",
};

function params(split: SplitName, over: Partial<RunParams> = {}): RunParams {
  return { split, variants: fixedVariants(GOLDEN_CONFIG), pool: "normal", mode: "fast", ...over };
}

function ranksOf(run: DatasetRun, user: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of run.perUser) if (r.userId === user) out[r.method] = r.rank;
  return out;
}

const golden = loadDataset(GOLDEN);

// DW1, worked out by hand. Window W = 7 days = 168 h, N_max = 2000, m = 5, alpha = 2, beta = 4, BL2t age weight 0.5,
// BL4 divisor 45000, BL5 gravity 1.8. Ages are in hours.
//
// User 4, validation item: event 21, a like on post 9 at 177 h. History: 3 positives (posts 2, 6, 7), bucket 1-4.
//   Followees {1, 5}, no community. The pool (window 9 h to 177 h, minus own post 4, minus touched posts 2, 6, 7,
//   post 1 is too old) is {9, 8, 5, 3}: ages 7, 17, 47, 67. Counts at 177 h: post 9 has 2 likes (events 19 and 20),
//   post 8 has 3 likes, post 5 has 2 likes, post 3 has 1 like and 1 repost.
//   BL0: post 5 (author 5 is a followee) first, then 9, 8, 3 -> rank 2.        BL1: 9, 8, 5, 3 -> rank 1.
//   BL2: 9: 2 - 1.75 = 0.25 -> 25; 8: 3 - 4.25 -> -125; 5: 2 - 11.75 -> -975; 3: 4 - 16.75 -> -1275 -> rank 1.
//   BL2t (0.5): 9: 2 - 3.5 -> -150; 8: 3 - 8.5 -> -550; 5 and 3 far below -> rank 1.
//   BL3: likes 8: 3, 9: 2, 5: 2, 3: 1; the tie 9 vs 5 goes to the larger id, so 8, 9, 5, 3 -> rank 2.
//   BL4: 9: log10(2) - 7 * 0.08 = -0.26 -> -26; 8: log10(3) - 1.36 = -0.88 -> -89; 5: -3.46; 3: -5.36 -> rank 1.
//   BL5: 9: 0.8 ln 2 - 1.8 ln 9 = -3.40 -> -341; 8: -4.42; 5: -6.45; 3: -7.62 -> rank 1.
//   BL6: followee count (author or engager): 9: 0; 8: 2 (users 1 and 5 liked it); 5: 1; 3: 1. 9: 25; 8: -125 + 400 = 275;
//        5: -975 + 200 = -775; 3: -1275 + 200 = -1075 -> 8, 9, 5, 3 -> rank 2.
//   H: trust(1) = (1 + 5/2) / (3 + 5) = 0.4375, trust(5) = 2.5 / 8 = 0.3125; community 1 gets (1 + 0) / 8 = 0.125.
//      9: 0.25 -> 25; 8: -1.25 + 2 * (0.4375 + 0.3125) + 4 * 0.125 = 0.75 -> 75; 5: -9.75 + 2 * 0.3125 = -9.125 -> -913;
//      3: -12.75 + 2 * 0.3125 + 4 * 0.125 = -11.625 -> -1163 -> 8, 9, 5, 3 -> rank 2.
//   H-follow: 8: -1.25 + 1.5 = 0.25 -> 25 ties with 9 (25); the larger id (9) wins -> rank 1.
//   H-comm: 8: -1.25 + 0.5 = -0.75 -> -75 -> rank 1.   H-noauthor: as H for post 8 and 9 -> rank 2.
//   H-noengager: 8: -1.25 + 0.5 = -0.75 -> -75 (no author part for 8) -> rank 1.
const USER4 = { BL0: 2, BL1: 1, BL2: 1, BL2t: 1, BL3: 2, BL4: 1, BL5: 1, BL6: 2, H: 2, "H-follow": 1, "H-comm": 1, "H-noauthor": 2, "H-noengager": 1 };
//
// User 1, validation item: event 22, a like on post 9 at 185 h. History: 4 positives (posts 2, 4, 6, 8), bucket 1-4.
//   Followees {2, 3}, community {1}. Pool (window 17 h to 185 h, minus own post 7, minus touched 2, 4, 6, 8): {10, 9, 5, 3},
//   ages 5, 15, 55, 75. Post 10 has no visible event yet (the first is at 186 h), post 9 has 3 likes (users 2, 9, 4).
//   BL1: 10, 9, 5, 3 -> rank 2.   BL0: followee authors (3) first: 9, 3, then 10, 5 -> rank 1.
//   BL2: 10: -1.25 -> -125; 9: 3 - 3.75 = -0.75 -> -75 -> rank 1.   BL2t (0.5): 10: -2.5; 9: 3 - 7.5 = -4.5 -> rank 2.
//   BL3: 9 has the most likes -> rank 1.   BL4: 10: 0 - 5 * 0.08 = -0.40 -> -40; 9: log10(3) - 1.2 = -0.72 -> -73 -> rank 2.
//   BL5: a post with no like is last: 9 first -> rank 1.
//   BL6: 9: author 3 is a followee, engager 2 is one: count 2 -> -0.75 + 4 = 3.25 -> 325 -> rank 1.
//   H: trust(2) = (2 + 2.5) / 9 = 0.5, trust(3) = 2.5 / 9; 9: -0.75 + 2 * (2.5/9 + 0.5) = 0.8056 -> 80; 10: -125 -> rank 1.
//   H-follow, H-comm, H-noauthor, H-noengager: 9 stays above 10 (-20 or more against -125) -> rank 1.
const USER1 = { BL0: 1, BL1: 2, BL2: 1, BL2t: 2, BL3: 1, BL4: 2, BL5: 1, BL6: 1, H: 1, "H-follow": 1, "H-comm": 1, "H-noauthor": 1, "H-noengager": 1 };
//
// User 7, validation item: event 31, a like on post 2 at 150 h. No history (bucket 0), no followee, no community.
//   Pool (window -18 h to 150 h): posts 1 to 6, ages 150, 50, 40, 30, 20, 10. Counts at 150 h: post 6: 2 likes, 1 comment;
//   5: 2 likes; 4: 2 likes; 3: 1 like, 1 repost; 2: 2 likes, 1 comment; 1: 1 like.
//   BL2: 6: 4 - 2.5 = 1.5 -> 150; 5: -3 -> -300; 4: -5.5; 3: 4 - 10 = -6; 2: 4 - 12.5 = -8.5; 1: -36.5 -> post 2 is 5th.
//   BL0, BL1, BL2t, BL4, BL6 and every H variant (no social or community data, so H = BL2): rank 5.
//   BL3: likes 2: posts 6, 5, 4, 2 (larger id first), then 3 and 1 -> rank 4.
//   BL5: 6: -3.92; 5: -5.01; 4: -5.68; 2: 0.8 ln 2 - 1.8 ln 52 = -6.56; 3: -6.73; 1: -9.04 -> rank 4.
const USER7 = { BL0: 5, BL1: 5, BL2: 5, BL2t: 5, BL3: 4, BL4: 5, BL5: 4, BL6: 5, H: 5, "H-follow": 5, "H-comm": 5, "H-noauthor": 5, "H-noengager": 5 };

test("golden: items per split, T, and the left-out user", () => {
  const val = runDataset("golden", golden, params("validation"), { expectedT: GOLDEN_T });
  assert.equal(val.T, GOLDEN_T);
  // Nine users have a validation item. User 8 acted on post 1, which is older than the window: left out.
  const usersWithRows = [...new Set(val.perUser.map((r) => r.userId))];
  assert.deepEqual(usersWithRows, [1, 2, 3, 4, 5, 6, 7, 9]);
  const bucket0 = val.leftOut.find((r) => r.bucket === "0");
  assert.deepEqual(bucket0, { dataset: "golden", split: "validation", bucket: "0", nTestUsers: 3, nLeftOut: 1 });
  assert.deepEqual(val.leftOut.find((r) => r.bucket === "all"), { dataset: "golden", split: "validation", bucket: "all", nTestUsers: 9, nLeftOut: 1 });
  // Five users have a test item (user 6 has none after T; users 7, 8 and 9 have a single event).
  const test_ = runDataset("golden", golden, params("test"), { expectedT: GOLDEN_T });
  assert.deepEqual([...new Set(test_.perUser.map((r) => r.userId))], [1, 2, 3, 4, 5]);
  assert.equal(test_.leftOut.find((r) => r.bucket === "all")?.nTestUsers, 5);
  assert.equal(test_.leftOut.find((r) => r.bucket === "all")?.nLeftOut, 0);
});

test("golden: ranks of users 4, 1 and 7 equal the hand work", () => {
  const val = runDataset("golden", golden, params("validation"), { expectedT: GOLDEN_T });
  assert.deepEqual(ranksOf(val, 4), USER4);
  assert.deepEqual(ranksOf(val, 1), USER1);
  assert.deepEqual(ranksOf(val, 7), USER7);
  // The other columns of the rows: bucket, history, followees, item.
  const row = (u: number, m: string): PerUserRow => val.perUser.find((r) => r.userId === u && r.method === m) as PerUserRow;
  assert.deepEqual(
    { b: row(4, "H").bucket, h: row(4, "H").nHistory, f: row(4, "H").nFollowees, p: row(4, "H").testPostId },
    { b: "1-4", h: 3, f: 2, p: 9 },
  );
  assert.deepEqual(
    { b: row(1, "H").bucket, h: row(1, "H").nHistory, f: row(1, "H").nFollowees, p: row(1, "H").testPostId },
    { b: "1-4", h: 4, f: 2, p: 9 },
  );
  assert.deepEqual(
    { b: row(7, "H").bucket, h: row(7, "H").nHistory, f: row(7, "H").nFollowees, p: row(7, "H").testPostId },
    { b: "0", h: 0, f: 0, p: 2 },
  );
});

test("golden: metrics of the hand ranks (rank 1 -> 1, rank 2 -> 1/log2(3), rank 5 -> 1/log2(6), rank 4 -> 1/log2(5))", () => {
  assert.equal(f6(ndcgAt(1, 10)), "1.000000");
  assert.equal(f6(ndcgAt(2, 10)), "0.630930"); // 1 / log2(3)
  assert.equal(f6(ndcgAt(4, 10)), "0.430677"); // 1 / log2(5)
  assert.equal(f6(ndcgAt(5, 10)), "0.386853"); // 1 / log2(6)
  assert.equal(recallAt(5, 5), 1);
  // User 7 is the only kept user of bucket 0 with a history of 0 besides user 9 (post 9, the newest of 8: rank 1 for most methods).
  const val = runDataset("golden", golden, params("validation"), { expectedT: GOLDEN_T });
  const bl2 = val.summary.filter((r) => r.method === "BL2" && r.bucket === "0" && r.k === 5);
  assert.equal(bl2.length, 1);
  assert.equal(bl2[0]?.nUsers, 2); // users 7 (rank 5) and 9 (rank 1)
  // (1 / log2(6) + 1) / 2 = (0.386853 + 1) / 2 = 0.693426
  assert.equal(bl2[0]?.ndcg, "0.693426");
  assert.equal(bl2[0]?.recall, "1.000000");
  const bl3 = val.summary.find((r) => r.method === "BL3" && r.bucket === "0" && r.k === 5) as { recall: string; ndcg: string };
  // user 7 has rank 4, user 9 has rank 7: recall@5 = 1 / 2, ndcg@5 = (1 / log2(5)) / 2 = 0.215338
  assert.equal(bl3.recall, "0.500000");
  assert.equal(bl3.ndcg, "0.215338");
});

for (const split of ["validation", "test"] as const) {
  test(`golden: the ${split} CSV files equal the committed expected files byte for byte`, () => {
    const run = runDataset("golden", golden, params(split), { expectedT: GOLDEN_T });
    const texts = resultTexts({ datasets: [run], inputs: {} });
    for (const [file, text] of [
      ["per_user.csv", texts.perUser],
      ["summary.csv", texts.summary],
      ["coverage.csv", texts.coverage],
      ["leftout.csv", texts.leftOut],
    ] as const) {
      const path = join(FIXTURES, "golden-expected", split, file);
      assert.ok(existsSync(path), `${path} is missing`);
      assert.equal(text, readFileSync(path, "utf8"), `${split}/${file}`);
    }
  });
}

test("T guard: a T that differs from the expected one stops with both values, and no T at all stops", () => {
  assert.throws(() => runDataset("golden", golden, params("validation"), { expectedT: GOLDEN_T + 1 }), (e: Error) => {
    return e.message.includes(String(GOLDEN_T)) && e.message.includes(String(GOLDEN_T + 1)) && /golden/.test(e.message);
  });
  assert.throws(() => runDataset("golden", golden, params("validation"), {}), /expectedT|recorded/);
  // A held T needs no computing and no check.
  const held = runDataset("golden", golden, params("validation"), { holdT: GOLDEN_T });
  assert.equal(held.T, GOLDEN_T);
});

test("runConfig stops for a dataset with no recorded T, before it loads or ranks anything", () => {
  assert.throws(() => runConfig(GOLDEN_CONFIG, { dataDir: FIXTURES }), /cutTimes/);
  const run = runConfig(GOLDEN_CONFIG, { dataDir: FIXTURES, cutTimes: { golden: GOLDEN_T } });
  assert.equal(run.datasets.length, 1);
  assert.equal(run.datasets[0]?.T, GOLDEN_T);
  assert.match(run.inputs.golden as string, /^[0-9a-f]{64}$/);
  // The test-split guard of the config comes first.
  assert.throws(() => runConfig({ ...GOLDEN_CONFIG, split: "test" }, { dataDir: "/nonexistent", cutTimes: {} }), /testApprovedBy/);
  assert.throws(() => runConfig({ ...GOLDEN_CONFIG, params: {} }, { dataDir: "/nonexistent", cutTimes: {} }), /param/);
});

test("an item on a post the user touched before, or on their own post, stops with the user and the post (design F8)", () => {
  const base = randomDataset({ ...SMALL, seed: 3 });
  const post = base.posts[0] as DatasetTables["posts"][number];
  const other = (base.users.find((u) => u.userId !== post.authorId) as { userId: number }).userId;
  const twice: DatasetTables = {
    ...base,
    interactions: [
      { eventId: 9001, userId: other, postId: post.postId, type: "like", createdAt: post.createdAt + 1 },
      { eventId: 9002, userId: other, postId: post.postId, type: "comment", createdAt: post.createdAt + 2 },
    ],
  };
  const v: RunParams = { split: "validation", variants: fixedVariants({ ...GOLDEN_CONFIG, methods: ["BL1"], params: {} }), pool: "normal", mode: "fast" };
  assert.throws(() => runDataset("x", twice, v, { holdT: post.createdAt + 10 }), (e: Error) => e.message.includes(`user ${other}`) && e.message.includes(`post ${post.postId}`));
  const own: DatasetTables = { ...base, interactions: [{ eventId: 9003, userId: post.authorId, postId: post.postId, type: "like", createdAt: post.createdAt + 1 }] };
  assert.throws(() => runDataset("x", own, v, { holdT: post.createdAt + 10 }), (e: Error) => e.message.includes(`user ${post.authorId}`) && /own/.test(e.message));
});

// DW2: leakage. Everything after the user's item time is deleted, changed or stuffed with new events. T is held.
function afterItem(e: { createdAt: number; eventId: number }, item: Event): boolean {
  return e.createdAt > item.t || (e.createdAt === item.t && e.eventId > item.id);
}

type Mutation = "delete" | "change" | "add";

function mutate(data: DatasetTables, item: Event, kind: Mutation): DatasetTables {
  const t = item.t;
  const maxEvent = data.interactions.reduce((m, e) => Math.max(m, e.eventId), 0);
  const maxPost = data.posts.reduce((m, p) => Math.max(m, p.postId), 0);
  const userIds = data.users.map((u) => u.userId).sort((a, b) => a - b);
  const rotate = { like: "comment", comment: "repost", repost: "like" } as const;
  if (kind === "delete") {
    return {
      ...data,
      interactions: data.interactions.filter((e) => !afterItem(e, item)),
      follows: data.follows.filter((f) => f.createdAt < t),
      memberships: data.memberships.filter((m) => m.joinedAt < t),
      posts: data.posts.filter((p) => p.createdAt < t || p.postId === item.post),
    };
  }
  if (kind === "change") {
    const next = (id: number): number => userIds[(userIds.indexOf(id) + 1) % userIds.length] as number;
    return {
      ...data,
      interactions: data.interactions.map((e) => (afterItem(e, item) ? { ...e, type: rotate[e.type] } : e)),
      follows: data.follows.map((f) => (f.createdAt >= t && next(f.followeeId) !== f.followerId ? { ...f, followeeId: next(f.followeeId) } : f)),
      memberships: data.memberships.map((m) => (m.joinedAt >= t ? { ...m, communityId: m.communityId + 100 } : m)),
      posts: data.posts.map((p) => (p.createdAt >= t && p.postId !== item.post ? { ...p, authorId: next(p.authorId), communityId: null } : p)),
    };
  }
  // add: events of the other users on the newest posts at the item time with a larger id (invisible by the tie rule), and
  // after it; the user follows everybody and joins every community at the item time and after it; new posts at t and t + 1.
  const newest = data.posts
    .filter((p) => p.createdAt < t)
    .sort((a, b) => b.createdAt - a.createdAt || b.postId - a.postId)
    .slice(0, 30);
  const interactions = [...data.interactions];
  let id = maxEvent;
  for (const u of userIds) {
    if (u === item.user) continue;
    for (const p of newest) {
      if (p.authorId === u) continue;
      interactions.push({ eventId: ++id, userId: u, postId: p.postId, type: "like", createdAt: t });
      interactions.push({ eventId: ++id, userId: u, postId: p.postId, type: "repost", createdAt: t + 1 });
    }
  }
  const follows = [...data.follows];
  for (const u of userIds) {
    if (u === item.user) continue;
    for (const when of [t, t + 1]) follows.push({ followerId: item.user, followeeId: u, createdAt: when });
  }
  const memberships = [...data.memberships];
  for (const c of data.communities) memberships.push({ userId: item.user, communityId: c.communityId + 1000, joinedAt: t }, { userId: item.user, communityId: c.communityId, joinedAt: t + 1 });
  const posts = [...data.posts];
  for (let i = 1; i <= 10; i++) posts.push({ postId: maxPost + i, authorId: userIds[i % userIds.length] as number, communityId: null, createdAt: i % 2 ? t : t + 1 });
  return { ...data, interactions, follows, memberships, posts };
}

const MUTATIONS: Mutation[] = ["delete", "change", "add"];

function rowsOf(data: DatasetTables, user: number, rp: RunParams, T: number): PerUserRow[] {
  return runDataset("leak", data, rp, { holdT: T, onlyUsers: new Set([user]) }).perUser;
}

test("leakage, golden: events after a user's item do not change that user's rows (DW2)", () => {
  for (const split of ["validation", "test"] as const) {
    const rp = params(split);
    const items = splitItems(positiveEvents(golden), GOLDEN_T, split);
    assert.ok(items.size >= 5);
    for (const [user, item] of items) {
      const before = rowsOf(golden, user, rp, GOLDEN_T);
      for (const kind of MUTATIONS) {
        const after = rowsOf(mutate(golden, item, kind), user, rp, GOLDEN_T);
        assert.deepEqual(after, before, `${split} user ${user} after "${kind}"`);
      }
    }
  }
});

test("leakage, syn-W2M-S: 30 users chosen with the bootstrap stream (DW2)", () => {
  const data = loadDataset(new URL("../../data/syn-W2M-S", import.meta.url).pathname);
  const T = frozen.cutTimes["syn-W2M-S"] as number;
  const rp: RunParams = { split: "validation", variants: fixedVariants(GOLDEN_CONFIG), pool: "normal", mode: "fast" };
  const items = splitItems(positiveEvents(data), T, "validation");
  const users = [...items.keys()].sort((a, b) => a - b);
  const g = rng(frozen.masterSeed, "bootstrap");
  const chosen: number[] = [];
  while (chosen.length < 30) {
    const u = users[g.int(users.length)] as number;
    if (!chosen.includes(u)) chosen.push(u);
  }
  let kept = 0;
  for (const user of chosen) {
    const item = items.get(user) as Event;
    const before = rowsOf(data, user, rp, T);
    if (before.length > 0) kept++;
    for (const kind of MUTATIONS) {
      assert.deepEqual(rowsOf(mutate(data, item, kind), user, rp, T), before, `user ${user} after "${kind}"`);
    }
  }
  assert.ok(kept >= 15, `only ${kept} of the 30 users were kept, so the test checks too little`);
});

test("fast and reference modes give byte-identical per_user rows (design F3)", () => {
  for (const split of ["validation", "test"] as const) {
    const fast = runDataset("golden", golden, params(split), { expectedT: GOLDEN_T });
    const ref = runDataset("golden", golden, params(split, { mode: "reference" }), { expectedT: GOLDEN_T });
    assert.equal(resultTexts({ datasets: [fast], inputs: {} }).perUser, resultTexts({ datasets: [ref], inputs: {} }).perUser);
  }
  const data = loadDataset(new URL("../../data/syn-W2M-S", import.meta.url).pathname);
  const T = frozen.cutTimes["syn-W2M-S"] as number;
  const fast = runDataset("syn-W2M-S", data, params("validation"), { expectedT: T });
  const ref = runDataset("syn-W2M-S", data, params("validation", { mode: "reference" }), { expectedT: T });
  const a = resultTexts({ datasets: [fast], inputs: {} });
  const b = resultTexts({ datasets: [ref], inputs: {} });
  assert.ok(fast.perUser.length > 1000);
  assert.equal(a.perUser, b.perUser);
  assert.equal(a.summary, b.summary);
  assert.equal(a.coverage, b.coverage);
  assert.equal(a.leftOut, b.leftOut);
});

test("onlyUsers ranks only those users and gives the same rows for them", () => {
  const all = runDataset("golden", golden, params("validation"), { expectedT: GOLDEN_T });
  const some = runDataset("golden", golden, params("validation"), { expectedT: GOLDEN_T, onlyUsers: new Set([1, 4]) });
  assert.deepEqual(
    some.perUser,
    all.perUser.filter((r) => r.userId === 1 || r.userId === 4),
  );
});

test("the large pool uses the frozen W_L and N_L, the normal pool W and N_max", () => {
  assert.deepEqual(poolSetting("normal"), { windowSec: frozen.windowDays * DAY, maxPosts: frozen.poolCap });
  assert.deepEqual(poolSetting("large"), { windowSec: frozen.poolLarge.windowDays * DAY, maxPosts: frozen.poolLarge.poolCap });
});

// DW6: the left-out counts of the harness equal the bucket table of checks/buckets.ts (P3). Counting only, no ranking.
for (const id of ["syn-W2M-S", "syn-W2M-M"]) {
  test(`item counts of the harness equal the bucket table of the P3 check on ${id}`, () => {
    const data = loadDataset(new URL(`../../data/${id}`, import.meta.url).pathname);
    const T = frozen.cutTimes[id] as number;
    const report = bucketReport(data, String(frozen.cutQuantile), frozen.windowDays * DAY, frozen.poolCap);
    assert.equal(report.cutTime, T);
    const counts = countItems(id, data, "test", "normal", { expectedT: T });
    assert.equal(counts.T, T);
    for (const row of report.rows) {
      const mine = counts.leftOut.find((r) => r.bucket === row.bucket);
      assert.deepEqual({ n: mine?.nTestUsers, left: mine?.nLeftOut }, { n: row.testUsers, left: row.leftOut }, `${id} bucket ${row.bucket}`);
    }
    assert.equal(counts.leftOut.find((r) => r.bucket === "all")?.nTestUsers, report.testUsers);
  });
}
