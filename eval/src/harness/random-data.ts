import type { Dataset } from "../canonical/dataset.ts";
import { rng } from "../rng.ts";

// Test helper: a small random dataset with many ties in time, for tests that compare two code paths.
// It is not used by the harness. It draws from the "parity" stream of the given seed, which no result file uses.

export type DatasetTables = Pick<Dataset, "users" | "follows" | "communities" | "memberships" | "posts" | "interactions">;

export interface RandomOptions {
  seed: number;
  users: number;
  posts: number;
  communities: number;
  follows: number;
  memberships: number;
  interactions: number;
  /** Times are integers in [0, timeSpan]. */
  timeSpan: number;
  /** Allow a user to act on the same post twice (the canonical files never do). */
  repeats?: boolean;
}

export const SMALL: RandomOptions = {
  seed: 7,
  users: 14,
  posts: 24,
  communities: 3,
  follows: 50,
  memberships: 12,
  interactions: 150,
  timeSpan: 60,
};

export function randomDataset(o: RandomOptions): DatasetTables {
  const g = rng(o.seed, "parity");
  // User ids are not 1..n on purpose: they start at 5 and skip some, like a real id column.
  const userIds = Array.from({ length: o.users }, (_, i) => 5 + i * 2 + (i % 3));
  const users = userIds.map((userId) => ({ userId, joinedAt: g.int(o.timeSpan + 1) }));
  const communities = Array.from({ length: o.communities }, (_, i) => ({ communityId: i + 1, createdAt: 0 }));
  const posts = Array.from({ length: o.posts }, (_, i) => ({
    postId: 100 + i * 3,
    authorId: userIds[g.int(o.users)] as number,
    communityId: g.int(4) === 0 ? null : 1 + g.int(o.communities),
    createdAt: g.int(o.timeSpan + 1),
  }));
  const follows: Dataset["follows"] = [];
  const seenFollow = new Set<string>();
  for (let i = 0; i < o.follows * 3 && follows.length < o.follows; i++) {
    const a = userIds[g.int(o.users)] as number;
    const b = userIds[g.int(o.users)] as number;
    if (a === b || seenFollow.has(`${a}:${b}`)) continue;
    seenFollow.add(`${a}:${b}`);
    follows.push({ followerId: a, followeeId: b, createdAt: g.int(o.timeSpan + 1) });
  }
  const memberships: Dataset["memberships"] = [];
  const seenMember = new Set<string>();
  for (let i = 0; i < o.memberships * 3 && memberships.length < o.memberships; i++) {
    const u = userIds[g.int(o.users)] as number;
    const c = 1 + g.int(o.communities);
    if (seenMember.has(`${u}:${c}`)) continue;
    seenMember.add(`${u}:${c}`);
    memberships.push({ userId: u, communityId: c, joinedAt: g.int(o.timeSpan + 1) });
  }
  // Event ids are a shuffle of 1..N, so the id order is not the time order and ties in time are broken by id.
  const ids = Array.from({ length: o.interactions }, (_, i) => i + 1);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = g.int(i + 1);
    [ids[i], ids[j]] = [ids[j] as number, ids[i] as number];
  }
  const interactions: Dataset["interactions"] = [];
  const seenPair = new Set<string>();
  const types = ["like", "comment", "repost"] as const;
  for (let i = 0; i < o.interactions; i++) {
    const userId = userIds[g.int(o.users)] as number;
    const post = posts[g.int(o.posts)] as Dataset["posts"][number];
    if (post.authorId === userId) continue;
    const key = `${userId}:${post.postId}`;
    if (!o.repeats && seenPair.has(key)) continue;
    seenPair.add(key);
    interactions.push({
      eventId: ids[i] as number,
      userId,
      postId: post.postId,
      type: types[g.int(3)] as (typeof types)[number],
      createdAt: Math.min(o.timeSpan, post.createdAt + g.int(o.timeSpan - post.createdAt + 1)),
    });
  }
  interactions.sort((a, b) => a.createdAt - b.createdAt || a.eventId - b.eventId);
  return { users, follows, communities, memberships, posts, interactions };
}
