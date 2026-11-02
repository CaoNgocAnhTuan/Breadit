import type { Rng } from "../rng.ts";
import type { GenParams } from "./config.ts";

export interface UserInfo {
  userId: number;
  joinedAt: number;
  /** Hidden main topic, 0 .. topics - 1. */
  mainTopic: number;
  /** Number of actions this user makes (before actions that find no candidate are dropped). */
  actionCount: number;
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

/** The cap on one user's actions: floor(maxUserActionShare x mean x users). */
export function activityCap(p: GenParams): number {
  return Math.floor(p.maxUserActionShare * p.interactionsPerUserMean * p.nUsers);
}

// Count k in [lo, hi] with weight 1/k, from one uniform draw. Only + and / are used.
function harmonicCount(draw: number, lo: number, hi: number): number {
  let total = 0;
  for (let k = lo; k <= hi; k++) total += 1 / k;
  const x = draw * total;
  let acc = 0;
  for (let k = lo; k <= hi; k++) {
    acc += 1 / k;
    if (acc > x) return k;
  }
  return hi;
}

// Number of actions: one bin by the four calibrated shares (1; 2-4; 5-19; 20 or more), then a count inside it.
// The bin 20 or more is floor(20 x Pareto(alpha_tail)), capped. All three draws are always taken.
function actionCount(r: Rng, p: GenParams): number {
  const binDraw = r.float();
  const kDraw = r.float();
  const tailDraw = r.float();
  const [s1, s2, s3] = p.activityBinShares as [number, number, number, number];
  if (binDraw < s1) return 1;
  if (binDraw < s1 + s2) return harmonicCount(kDraw, 2, 4);
  if (binDraw < s1 + s2 + s3) return harmonicCount(kDraw, 5, 19);
  return Math.min(Math.floor(20 * Math.pow(1 - tailDraw, -1 / p.activityTailAlpha)), activityCap(p));
}

// Stage 1. Ids 1..N. Most users join before the activity span; a chosen share joins inside it.
export function genUsers(r: Rng, p: GenParams): UserInfo[] {
  const users: UserInfo[] = [];
  for (let i = 1; i <= p.nUsers; i++) {
    const late = r.float() < p.lateJoinerShare;
    const joinedAt = late ? p.spanStart + r.int(p.spanEnd - DAY - p.spanStart) : r.int(p.spanStart);
    const mainTopic = r.int(p.topics);
    const actions = actionCount(r, p);
    const listWeight = pareto(r, p.secondaryParetoAlpha);
    const popularity = pareto(r, p.secondaryParetoAlpha);
    const postingWeight = pareto(r, p.secondaryParetoAlpha);
    users.push({ userId: i, joinedAt, mainTopic, actionCount: actions, listWeight, popularity, postingWeight });
  }
  return users;
}
