import type { Follow } from "../canonical/dataset.ts";
import type { Rng } from "../rng.ts";
import { allocate } from "./alloc.ts";
import type { GenParams } from "./config.ts";
import { homophilyWeight, userSimilarity } from "./interest.ts";
import type { UserInfo } from "./users.ts";

// Time of a link: after both users joined. Most links are dated before the activity span.
function linkTime(r: Rng, p: GenParams, a: UserInfo, b: UserInfo): number {
  const joined = Math.max(a.joinedAt, b.joinedAt);
  const inSpan = r.float() < p.followInSpanShare || joined >= p.spanStart;
  const lo = inSpan ? Math.max(joined, p.spanStart) : joined;
  const hi = inSpan ? p.spanEnd : p.spanStart;
  return lo + r.int(hi - lo);
}

// Stage 2. A chosen share of users has a follow list. A followee is drawn without replacement with
// weight popularity x (1 - h + h x similarity). A chosen share of links is returned, but only to followees that have a list.
export function genFollows(r: Rng, p: GenParams, users: readonly UserInfo[]): Follow[] {
  const n = users.length;
  const holders: UserInfo[] = [];
  for (const u of users) if (r.float() < p.followListShare) holders.push(u);

  const total = Math.round(p.followeesMean * holders.length);
  const extra = Math.max(0, total - holders.length);
  const counts = holders.length === 0 ? [] : allocate(extra, holders.map((u) => u.listWeight));

  const out: Follow[] = [];
  const pairs = new Set<number>();
  const key = (a: number, b: number): number => a * (n + 1) + b;
  const w = new Float64Array(n);

  holders.forEach((u, k) => {
    const want = Math.min(1 + (counts[k] as number), n - 1);
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const v = users[i] as UserInfo;
      w[i] = v.userId === u.userId ? 0 : v.popularity * homophilyWeight(p, userSimilarity(p, u.mainTopic, v.mainTopic));
      sum += w[i] as number;
    }
    for (let j = 0; j < want; j++) {
      const x = r.float() * sum;
      let acc = 0;
      let pick = -1;
      for (let i = 0; i < n; i++) {
        const wi = w[i] as number;
        if (wi <= 0) continue;
        acc += wi;
        pick = i;
        if (acc > x) break;
      }
      if (pick < 0) break;
      sum -= w[pick] as number;
      w[pick] = 0;
      const v = users[pick] as UserInfo;
      out.push({ followerId: u.userId, followeeId: v.userId, createdAt: linkTime(r, p, u, v) });
      pairs.add(key(u.userId, v.userId));
    }
  });

  // A link is returned only when the followee also has a list, so users without a list follow nobody.
  const holderIds = new Set(holders.map((u) => u.userId));
  const forward = out.length;
  for (let i = 0; i < forward; i++) {
    const f = out[i] as Follow;
    if (r.float() < p.twoWayShare && holderIds.has(f.followeeId) && !pairs.has(key(f.followeeId, f.followerId))) {
      const a = users[f.followeeId - 1] as UserInfo;
      const b = users[f.followerId - 1] as UserInfo;
      out.push({ followerId: a.userId, followeeId: b.userId, createdAt: linkTime(r, p, a, b) });
      pairs.add(key(a.userId, b.userId));
    }
  }
  return out;
}
