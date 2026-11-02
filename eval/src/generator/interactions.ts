import type { Follow, Interaction, Membership } from "../canonical/dataset.ts";
import type { Rng } from "../rng.ts";
import { allocate } from "./alloc.ts";
import type { GenParams } from "./config.ts";
import { interestMain, interestOther } from "./interest.ts";
import type { GenPost } from "./posts.ts";
import type { UserInfo } from "./users.ts";

interface Action {
  t: number;
  user: number;
  k: number;
}

function firstAtLeast(times: Float64Array, x: number): number {
  let lo = 0;
  let hi = times.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if ((times[mid] as number) < x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

// Stage 5. Each user gets a number of actions from the activity weights; the total is the mean x N.
// All actions are processed in (t, user_id, k) order. At each action the user picks one post from the
// candidates (created in [t - W_gen, t), not their own, not already acted on) with one draw over the weights:
//
//   weight(u, p, t) = interest(u, topic p) fresh(p, t) (1 + pi n_p) (1 + g_s S(u, p, t)) (1 + g_c [member])
//   fresh(p, t)     = 1 / (1 + age hours / tau)
//   S(u, p, t)      = [u follows author(p) at t] + number of followees of u who acted on p before t
//
// Weights are summed in post id order. Only + - * / are used. The generator never ranks a feed.
export function genInteractions(
  r: Rng,
  p: GenParams,
  users: readonly UserInfo[],
  follows: readonly Follow[],
  memberships: readonly Membership[],
  posts: readonly GenPost[],
): { interactions: Interaction[]; skipped: number } {
  const n = users.length;
  const nPosts = posts.length;

  const total = Math.round(p.interactionsPerUserMean * n);
  const counts = allocate(total, users.map((u) => u.activityWeight));
  const actions: Action[] = [];
  users.forEach((u, i) => {
    const from = Math.max(p.spanStart, u.joinedAt);
    for (let k = 0; k < (counts[i] as number); k++) actions.push({ t: from + r.int(p.spanEnd - from), user: u.userId, k });
  });
  actions.sort((a, b) => a.t - b.t || a.user - b.user || a.k - b.k);

  const created = new Float64Array(nPosts);
  const author = new Int32Array(nPosts);
  const topic = new Int32Array(nPosts);
  const community = new Int32Array(nPosts); // 0 = none
  posts.forEach((x, i) => {
    created[i] = x.createdAt;
    author[i] = x.authorId;
    topic[i] = x.topic;
    community[i] = x.communityId ?? 0;
  });

  // follow dates: user to array indexed by followee id, -1 = none
  const followDate = new Map<number, Int32Array>();
  for (const f of follows) {
    let a = followDate.get(f.followerId);
    if (!a) {
      a = new Int32Array(n + 1).fill(-1);
      followDate.set(f.followerId, a);
    }
    a[f.followeeId] = f.createdAt;
  }
  const memberSince = new Map<number, Int32Array>();
  for (const m of memberships) {
    let a = memberSince.get(m.userId);
    if (!a) {
      a = new Int32Array(p.topics + 1).fill(-1);
      memberSince.set(m.userId, a);
    }
    a[m.communityId] = m.joinedAt;
  }

  const hiInterest = interestMain(p);
  const loInterest = interestOther(p);
  const tauSec = 3600 * p.freshnessTauHours;
  const useSocial = p.influenceSocial !== 0;
  const useCommunity = p.influenceCommunity !== 0;

  const acted: Array<Set<number>> = users.map(() => new Set<number>());
  const nActions = new Int32Array(nPosts);
  const actors: number[][] = Array.from({ length: nPosts }, () => []);
  const w = new Float64Array(nPosts);

  const out: Interaction[] = [];
  let skipped = 0;
  for (const a of actions) {
    const pickDraw = r.float();
    const typeDraw = r.float();
    const t = a.t;
    const u = a.user;
    const main = (users[u - 1] as UserInfo).mainTopic;
    const lo = firstAtLeast(created, t - p.candidateWindowSec);
    const hi = firstAtLeast(created, t);
    const fd = followDate.get(u);
    const ms = memberSince.get(u);
    const mine = acted[u - 1] as Set<number>;

    let sum = 0;
    for (let i = lo; i < hi; i++) {
      if (author[i] === u || mine.has(i + 1)) {
        w[i] = 0;
        continue;
      }
      let wi = (topic[i] === main ? hiInterest : loInterest) * (1 / (1 + ((t - (created[i] as number)) / tauSec)));
      wi *= 1 + p.popularityPi * (nActions[i] as number);
      if (useSocial && fd) {
        let s = 0;
        const d = fd[author[i] as number] as number;
        if (d >= 0 && d < t) s = 1;
        for (const actor of actors[i] as number[]) {
          const da = fd[actor] as number;
          if (da >= 0 && da < t) s++;
        }
        wi *= 1 + p.influenceSocial * s;
      }
      if (useCommunity && ms && (community[i] as number) > 0) {
        const since = ms[community[i] as number] as number;
        if (since >= 0 && since <= t) wi *= 1 + p.influenceCommunity;
      }
      w[i] = wi;
      sum += wi;
    }
    if (!(sum > 0)) {
      skipped++;
      continue;
    }
    const x = pickDraw * sum;
    let acc = 0;
    let pick = -1;
    for (let i = lo; i < hi; i++) {
      const wi = w[i] as number;
      if (wi <= 0) continue;
      acc += wi;
      pick = i;
      if (acc > x) break;
    }
    mine.add(pick + 1);
    nActions[pick]!++;
    (actors[pick] as number[]).push(u);
    const type =
      typeDraw < p.typeShareLike ? "like" : typeDraw < p.typeShareLike + p.typeShareComment ? "comment" : "repost";
    out.push({ eventId: out.length + 1, userId: u, postId: pick + 1, type, createdAt: t });
  }
  return { interactions: out, skipped };
}
