import type { Community, Membership } from "../canonical/dataset.ts";
import type { Rng } from "../rng.ts";
import type { GenParams } from "./config.ts";
import { homophilyWeight, topicAffinity } from "./interest.ts";
import type { UserInfo } from "./users.ts";

const DAY = 86400;

// Stage 3. One community per topic (id = topic + 1), created at the base epoch. Memberships use the
// same homophily rule as follows: in W0 they are random, in W1 and W2 they follow interests.
export function genCommunities(
  r: Rng,
  p: GenParams,
  users: readonly UserInfo[],
): { communities: Community[]; memberships: Membership[] } {
  const communities: Community[] = [];
  for (let z = 0; z < p.topics; z++) communities.push({ communityId: z + 1, createdAt: 0 });

  const memberships: Membership[] = [];
  const w = new Float64Array(p.topics);
  for (const u of users) {
    const none = r.float() < p.noMembershipShare;
    if (none) continue;
    const want = Math.min(1 + r.int(p.maxMembershipsPerUser), p.topics);
    let sum = 0;
    for (let z = 0; z < p.topics; z++) {
      w[z] = homophilyWeight(p, topicAffinity(p, u.mainTopic, z));
      sum += w[z] as number;
    }
    for (let j = 0; j < want; j++) {
      const x = r.float() * sum;
      let acc = 0;
      let pick = -1;
      for (let z = 0; z < p.topics; z++) {
        const wz = w[z] as number;
        if (wz <= 0) continue;
        acc += wz;
        pick = z;
        if (acc > x) break;
      }
      if (pick < 0) break;
      sum -= w[pick] as number;
      w[pick] = 0;
      const lo = u.joinedAt;
      const hi = lo < p.spanStart ? p.spanStart : p.spanEnd - DAY;
      memberships.push({ userId: u.userId, communityId: pick + 1, joinedAt: lo + r.int(hi - lo) });
    }
  }
  return { communities, memberships };
}
