import type { Rng } from "../rng.ts";
import type { GenParams } from "./config.ts";

export interface UserInfo {
  userId: number;
  joinedAt: number;
  /** Hidden main topic, 0 .. topics - 1. */
  mainTopic: number;
  /** Pareto weight: share of all actions. */
  activityWeight: number;
  /** Pareto weight: length of the follow list. */
  listWeight: number;
  /** Pareto weight: how likely other users follow this one. */
  popularity: number;
  /** Pareto weight: share of all posts. */
  postingWeight: number;
}

const DAY = 86400;

function pareto(r: Rng, alpha: number): number {
  // 1 - float() is in (0, 1], so the weight is at least 1. Math.pow is used only here, in stage 1.
  return Math.pow(1 - r.float(), -1 / alpha);
}

// Stage 1. Ids 1..N. Most users join before the activity span; a chosen share joins inside it.
export function genUsers(r: Rng, p: GenParams): UserInfo[] {
  const users: UserInfo[] = [];
  for (let i = 1; i <= p.nUsers; i++) {
    const late = r.float() < p.lateJoinerShare;
    const joinedAt = late ? p.spanStart + r.int(p.spanEnd - DAY - p.spanStart) : r.int(p.spanStart);
    const mainTopic = r.int(p.topics);
    const activityWeight = pareto(r, p.activityParetoAlpha);
    const listWeight = pareto(r, p.secondaryParetoAlpha);
    const popularity = pareto(r, p.secondaryParetoAlpha);
    const postingWeight = pareto(r, p.secondaryParetoAlpha);
    users.push({ userId: i, joinedAt, mainTopic, activityWeight, listWeight, popularity, postingWeight });
  }
  return users;
}
