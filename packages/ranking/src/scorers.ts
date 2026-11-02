import { ageHours } from './asof';
import { computeExploreScoreFixed } from './explore';
import type { MethodId, Post, PostFeatures, Scorer, ScoreContext, UserFeatures, UserId } from './types';

// One scorer per method id (super-plan sections 5 and 6, design "Scorers"). Each returns one integer.
// Notation: age is the post age in hours at asOf; eng(w) = likes + 2 comments + 3 reposts - w age;
// F(x) = floor(x * 100) is the frozen score unit.

/** BL0 puts followee posts first: one integer, 2^32 + createdAt (design F7: far below 2^53 until the year 2106). */
const FOLLOWEE_BAND = 2 ** 32;
/** BL5: a post with no like gets the lowest band. */
const LOWEST_BAND = -(2 ** 31);
/** The age weight of the engagement score of H and BL6: the production Explore value. */
const ENGAGEMENT_AGE_WEIGHT = 0.25;

/** F(x). A score that is not finite is an error, not a number: NaN would break the total order. */
function fixed(x: number): number {
  if (!Number.isFinite(x)) throw new Error(`score is not finite (${x}); check the params`);
  return Math.floor(x * 100);
}

/** A required param. A missing one throws, so a typo cannot fall back to a default (design F8). */
function param(ctx: ScoreContext, name: string): number {
  const v = ctx.params[name];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new Error(`missing or invalid param "${name}"`);
  return v;
}

function engagement(pf: PostFeatures, age: number, ageWeight: number): number {
  return pf.likes + pf.comments * 2 + pf.reposts * 3 - age * ageWeight;
}

// Membership sets, built once per UserFeatures object. They are caches only and never change a result.
const followeeSets = new WeakMap<UserFeatures, ReadonlySet<UserId>>();
const communitySets = new WeakMap<UserFeatures, ReadonlySet<number>>();

function followeeSet(uf: UserFeatures): ReadonlySet<UserId> {
  let s = followeeSets.get(uf);
  if (s === undefined) {
    s = new Set(uf.followees);
    followeeSets.set(uf, s);
  }
  return s;
}

function communitySet(uf: UserFeatures): ReadonlySet<number> {
  let s = communitySets.get(uf);
  if (s === undefined) {
    s = new Set(uf.communities);
    communitySets.set(uf, s);
  }
  return s;
}

/**
 * trust(f) = (nByAuthor[f] + m / |F_u|) / (nTotal + m).
 * With |F_u| = 0 the prior part is 0. With nTotal + m = 0 (m = 0 and no history) the term is 0, not 0/0.
 */
function trust(uf: UserFeatures, f: UserId, m: number): number {
  const denom = uf.nTotal + m;
  if (denom === 0) return 0;
  const prior = uf.followees.length === 0 ? 0 : m / uf.followees.length;
  return ((uf.nByAuthor.get(f) ?? 0) + prior) / denom;
}

/**
 * community(c) = (nByCommunity[c] + m [c in M_u] / |M_u|) / (nTotal + m); 0 for a post with no community.
 * With nTotal + m = 0 the term is 0. A member community always has |M_u| >= 1.
 */
function communityTerm(uf: UserFeatures, c: number | null, m: number): number {
  if (c === null) return 0;
  const denom = uf.nTotal + m;
  if (denom === 0) return 0;
  const prior = communitySet(uf).has(c) ? m / uf.communities.length : 0;
  return ((uf.nByCommunity.get(c) ?? 0) + prior) / denom;
}

/**
 * social(p) = [author in F_u] trust(author) + the sum of trust(f) over f in engagedBy and F_u.
 * The sum runs in engagedBy order, which is sorted (super-plan section 2). `author` and `engagers`
 * switch the two parts on and off for the H-noauthor and H-noengager ablations.
 */
function socialTerm(uf: UserFeatures, post: Post, pf: PostFeatures, m: number, author: boolean, engagers: boolean): number {
  const followees = followeeSet(uf);
  let sum = 0;
  if (author && followees.has(post.authorId)) sum += trust(uf, post.authorId, m);
  if (engagers) {
    for (const f of pf.engagedBy) {
      if (followees.has(f)) sum += trust(uf, f, m);
    }
  }
  return sum;
}

interface HybridTerms {
  /** Needs the param `alpha`, and computes the social term. */
  social: boolean;
  /** Needs the param `beta`, and computes the community term. */
  community: boolean;
  author: boolean;
  engagers: boolean;
}

/**
 * H = eng(0.25) + alpha social + beta community. The ablations switch terms off, and then their weight
 * is neither read nor required: H-follow (beta = 0) needs alpha and m, H-comm (alpha = 0) needs beta and m.
 */
function hybrid(terms: HybridTerms): Scorer {
  return (ctx, post, pf) => {
    const alpha = terms.social ? param(ctx, 'alpha') : 0;
    const beta = terms.community ? param(ctx, 'beta') : 0;
    const m = param(ctx, 'm');
    let x = engagement(pf, ageHours(pf.createdAt, ctx.asOf), ENGAGEMENT_AGE_WEIGHT);
    if (terms.social) x += alpha * socialTerm(ctx.uf, post, pf, m, terms.author, terms.engagers);
    if (terms.community) x += beta * communityTerm(ctx.uf, post.communityId, m);
    return fixed(x);
  };
}

/** The scorer of a method. It throws on an unknown method, and the scorer throws on a missing param. */
export function scorer(method: MethodId): Scorer {
  switch (method) {
    case 'BL0':
      // Followee posts first, then the rest; newest first inside each group.
      return (ctx, post) => (followeeSet(ctx.uf).has(post.authorId) ? FOLLOWEE_BAND : 0) + post.createdAt;
    case 'BL1':
      return (_ctx, post) => post.createdAt;
    case 'BL2':
      // The production Explore score, as of asOf.
      return (ctx, _post, pf) =>
        computeExploreScoreFixed({
          likes: pf.likes,
          comments: pf.comments,
          reposts: pf.reposts,
          ageHours: ageHours(pf.createdAt, ctx.asOf),
        });
    case 'BL2t':
      // BL2 with a tuned age weight. At 0.25 it equals BL2.
      return (ctx, _post, pf) => fixed(engagement(pf, ageHours(pf.createdAt, ctx.asOf), param(ctx, 'ageWeight')));
    case 'BL3':
      return (_ctx, _post, pf) => fixed(pf.likes);
    case 'BL4':
      // Reddit "hot" with likes as upvotes. The epoch is asOf.t, which adds the same constant to every post of the pool.
      return (ctx, _post, pf) => {
        const divisor = param(ctx, 'divisor');
        const sign = pf.likes > 0 ? 1 : 0;
        return fixed(sign * Math.log10(Math.max(pf.likes, 1)) + (pf.createdAt - ctx.asOf.t) / divisor);
      };
    case 'BL5':
      // Hacker News: ln of (P-1)^0.8 / (T+2)^gravity with P-1 = likes. Same order, and it keeps a 1% step.
      return (ctx, _post, pf) => {
        const gravity = param(ctx, 'gravity');
        if (pf.likes === 0) return LOWEST_BAND;
        return fixed(0.8 * Math.log(pf.likes) - gravity * Math.log(ageHours(pf.createdAt, ctx.asOf) + 2));
      };
    case 'BL6':
      // H-follow with every trust weight set to 1.
      return (ctx, post, pf) => {
        const alpha = param(ctx, 'alpha');
        const followees = followeeSet(ctx.uf);
        let count = followees.has(post.authorId) ? 1 : 0;
        for (const f of pf.engagedBy) if (followees.has(f)) count++;
        return fixed(engagement(pf, ageHours(pf.createdAt, ctx.asOf), ENGAGEMENT_AGE_WEIGHT) + alpha * count);
      };
    case 'H':
      return hybrid({ social: true, community: true, author: true, engagers: true });
    case 'H-follow':
      return hybrid({ social: true, community: false, author: true, engagers: true });
    case 'H-comm':
      return hybrid({ social: false, community: true, author: true, engagers: true });
    case 'H-noauthor':
      return hybrid({ social: true, community: true, author: false, engagers: true });
    case 'H-noengager':
      return hybrid({ social: true, community: true, author: true, engagers: false });
    default:
      throw new Error(`unknown method "${String(method)}"`);
  }
}
