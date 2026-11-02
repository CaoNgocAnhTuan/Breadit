import type { Membership, Post } from "../canonical/dataset.ts";
import type { Rng } from "../rng.ts";
import type { GenParams } from "./config.ts";
import type { UserInfo } from "./users.ts";

export interface GenPost extends Post {
  /** Hidden topic, 0 .. topics - 1. A community post has the topic of its community. */
  topic: number;
}

interface Draft {
  authorId: number;
  createdAt: number;
  communityId: number | null;
  topic: number;
  k: number;
}

// Stage 4. The author is drawn by posting weight. The time is uniform in the activity span, after the
// author joined. A chosen share of posts goes to a community where the author is a member at created_at (D1).
// Ids follow (created_at, author_id, draw order), so a higher id is a newer post.
export function genPosts(r: Rng, p: GenParams, users: readonly UserInfo[], memberships: readonly Membership[]): GenPost[] {
  const prefix: number[] = [];
  let sum = 0;
  for (const u of users) {
    sum += u.postingWeight;
    prefix.push(sum);
  }
  const memberOf = new Map<number, Membership[]>();
  for (const m of memberships) {
    const l = memberOf.get(m.userId);
    if (l) l.push(m);
    else memberOf.set(m.userId, [m]);
  }
  for (const l of memberOf.values()) l.sort((a, b) => a.communityId - b.communityId);

  const drafts: Draft[] = [];
  for (let k = 0; k < p.nPosts; k++) {
    const x = r.float() * sum;
    let lo = 0;
    let hi = users.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if ((prefix[mid] as number) > x) hi = mid;
      else lo = mid + 1;
    }
    const author = users[lo] as UserInfo;
    const from = Math.max(p.spanStart, author.joinedAt);
    const createdAt = from + r.int(p.spanEnd - from);
    const toCommunity = r.float() < p.communityPostShare;
    const pick = r.float();
    const ownTopic = r.float() < 1 - p.interestSpread ? author.mainTopic : r.int(p.topics);
    let communityId: number | null = null;
    let topic = ownTopic;
    if (toCommunity) {
      const open = (memberOf.get(author.userId) ?? []).filter((m) => m.joinedAt <= createdAt);
      if (open.length > 0) {
        communityId = (open[Math.floor(pick * open.length)] as Membership).communityId;
        topic = communityId - 1;
      }
    }
    drafts.push({ authorId: author.userId, createdAt, communityId, topic, k });
  }
  drafts.sort((a, b) => a.createdAt - b.createdAt || a.authorId - b.authorId || a.k - b.k);
  return drafts.map((d, i) => ({
    postId: i + 1,
    authorId: d.authorId,
    communityId: d.communityId,
    createdAt: d.createdAt,
    topic: d.topic,
  }));
}
