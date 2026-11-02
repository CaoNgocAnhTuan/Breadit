import { rankPool } from './rank';
import { scorer } from './scorers';
import type { AsOf, MethodId, Post, PostFeatures, ScoreContext, UserFeatures } from './types';

// ---------------------------------------------------------------------------------------------
// One small pool. Every expected score below was worked out by hand from the design's scorer table
// (super-plan sections 5 and 6) and is written in the comments. F(x) = floor(x * 100).
//
// asOf.t = 360000 s (100 h after the epoch of the test). Age h hours means createdAt = 360000 - 3600 h.
// User u1 follows u2 and u3 (|F| = 2) and is a member of community 7 (|M| = 1).
// Earlier positives of u1: nTotal = 10, of which 3 on posts of u2 and 1 on posts of u3; 2 in community 7.
// The prior strength m = 4 is a test input.
//
//  id  author  community  age  likes comments reposts  engagedBy
//   1   u2        7         4h    2      1        0     [u3, u9]
//   2   u9        -         8h    6      0        1     [u2, u3, u4]
//   3   u3        8         2h    0      0        0     []
//   4   u9        7         2h    1      0        0     [u4]
//   5   u3        7        24h    2      0        0     [u2, u3]
//
//  eng(0.25) = likes + 2 comments + 3 reposts - 0.25 age:
//   1: 2 + 2 + 0 - 1 = 3     2: 6 + 0 + 3 - 2 = 7     3: 0 - 0.5 = -0.5     4: 1 - 0.5 = 0.5     5: 2 - 6 = -4
// ---------------------------------------------------------------------------------------------

const U1 = 'u0000000001';
const U2 = 'u0000000002';
const U3 = 'u0000000003';
const U4 = 'u0000000004';
const U9 = 'u0000000009';

const asOf: AsOf = { t: 360000, beforeEventId: 1 };
const created = (h: number): number => 360000 - 3600 * h;

function mkPost(id: number, authorId: string, communityId: number | null, h: number): Post {
  return { id, authorId, communityId, createdAt: created(h), isApproved: true, deleted: false };
}

const posts: Post[] = [mkPost(1, U2, 7, 4), mkPost(2, U9, null, 8), mkPost(3, U3, 8, 2), mkPost(4, U9, 7, 2), mkPost(5, U3, 7, 24)];

function mkFeatures(post: Post, likes: number, comments: number, reposts: number, engagedBy: string[]): PostFeatures {
  return { likes, comments, reposts, createdAt: post.createdAt, engagedBy };
}

const features: PostFeatures[] = [
  mkFeatures(posts[0], 2, 1, 0, [U3, U9]),
  mkFeatures(posts[1], 6, 0, 1, [U2, U3, U4]),
  mkFeatures(posts[2], 0, 0, 0, []),
  mkFeatures(posts[3], 1, 0, 0, [U4]),
  mkFeatures(posts[4], 2, 0, 0, [U2, U3]),
];

const uf: UserFeatures = {
  followees: [U2, U3],
  communities: [7],
  nByAuthor: new Map([
    [U2, 3],
    [U3, 1],
  ]),
  nByCommunity: new Map([[7, 2]]),
  nTotal: 10,
};

// No history: the prior alone.
const ufNoHistory: UserFeatures = { followees: [U2, U3], communities: [7], nByAuthor: new Map(), nByCommunity: new Map(), nTotal: 0 };
// No followee and no community, no history.
const ufEmpty: UserFeatures = { followees: [], communities: [], nByAuthor: new Map(), nByCommunity: new Map(), nTotal: 0 };

function ctxOf(params: Record<string, number>, features_: UserFeatures = uf): ScoreContext {
  return { user: U1, asOf, uf: features_, params };
}

/** The scores of posts 1 to 5, in id order. */
function scores(method: MethodId, params: Record<string, number>, features_: UserFeatures = uf): number[] {
  const s = scorer(method);
  const ctx = ctxOf(params, features_);
  return posts.map((p, i) => s(ctx, p, features[i]));
}

/** The ranking of the pool by one method: post ids, best first. */
function order(method: MethodId, params: Record<string, number>, features_: UserFeatures = uf): number[] {
  const s = scorer(method);
  const ctx = ctxOf(params, features_);
  return rankPool(posts, (p) => s(ctx, p, features[p.id - 1]));
}

const HP = { alpha: 8, beta: 2, m: 4 };

describe('BL0, BL1: the production feeds', () => {
  it('BL0: followee posts first (2^32 + createdAt), then the rest; newest first inside each', () => {
    // followee authors: posts 1 (u2), 3 (u3), 5 (u3). 2^32 = 4294967296.
    // 1: 4294967296 + 345600 = 4295312896    3: 4294967296 + 352800 = 4295320096    5: 4294967296 + 273600 = 4295240896
    // 2: 331200    4: 352800
    expect(scores('BL0', {})).toEqual([4295312896, 331200, 4295320096, 352800, 4295240896]);
    expect(order('BL0', {})).toEqual([3, 1, 5, 4, 2]);
  });

  it('BL0: a followee post of the oldest time still beats a non-followee post of the newest time (design F7)', () => {
    const s = scorer('BL0');
    const old = { ...posts[0], createdAt: 0 };
    const fresh = { ...posts[1], createdAt: 4_000_000_000 };
    const ctx = ctxOf({});
    const a = s(ctx, old, { ...features[0], createdAt: 0 });
    const b = s(ctx, fresh, { ...features[1], createdAt: 4_000_000_000 });
    expect(a).toBe(4294967296);
    expect(b).toBe(4_000_000_000);
    expect(a).toBeGreaterThan(b);
    expect(Number.isSafeInteger(a)).toBe(true);
    expect(Number.isSafeInteger(2 ** 32 + 4_000_000_000)).toBe(true);
  });

  it('BL1: createdAt; ties go to the larger id', () => {
    // 1: 345600  2: 331200  3: 352800  4: 352800  5: 273600
    expect(scores('BL1', {})).toEqual([345600, 331200, 352800, 352800, 273600]);
    expect(order('BL1', {})).toEqual([4, 3, 1, 2, 5]);
  });
});

describe('BL2, BL2t, BL3: engagement baselines', () => {
  it('BL2: the production Explore score as of asOf', () => {
    // F(3) = 300   F(7) = 700   F(-0.5) = -50   F(0.5) = 50   F(-4) = -400
    expect(scores('BL2', {})).toEqual([300, 700, -50, 50, -400]);
    expect(order('BL2', {})).toEqual([2, 1, 4, 3, 5]);
  });

  it('BL2t with ageWeight 0.5', () => {
    // eng(0.5) = likes + 2 comments + 3 reposts - 0.5 age
    // 1: 4 - 2 = 2 -> 200    2: 9 - 4 = 5 -> 500    3: 0 - 1 = -1 -> -100    4: 1 - 1 = 0 -> 0    5: 2 - 12 = -10 -> -1000
    expect(scores('BL2t', { ageWeight: 0.5 })).toEqual([200, 500, -100, 0, -1000]);
    expect(order('BL2t', { ageWeight: 0.5 })).toEqual([2, 1, 4, 3, 5]);
  });

  it('BL2t at ageWeight 0.25 equals BL2', () => {
    expect(scores('BL2t', { ageWeight: 0.25 })).toEqual(scores('BL2', {}));
  });

  it('BL2t at ageWeight 0 ignores age', () => {
    // 1: 4 -> 400    2: 9 -> 900    3: 0    4: 1 -> 100    5: 2 -> 200
    expect(scores('BL2t', { ageWeight: 0 })).toEqual([400, 900, 0, 100, 200]);
  });

  it('BL3: F(likes)', () => {
    // 1: 200   2: 600   3: 0   4: 100   5: 200 (ties between 1 and 5 go to the larger id)
    expect(scores('BL3', {})).toEqual([200, 600, 0, 100, 200]);
    expect(order('BL3', {})).toEqual([2, 5, 1, 4, 3]);
  });
});

describe('BL4 (Reddit hot) and BL5 (Hacker News)', () => {
  it('BL4 at the published divisor 45000', () => {
    // F(sign * log10(max(likes, 1)) + (createdAt - t) / 45000), sign = 1 if likes > 0 else 0
    // 1: log10(2) = 0.30103, -14400/45000 = -0.32       -> -0.01897 -> -1.897 -> -2
    // 2: log10(6) = 0.77815, -28800/45000 = -0.64       ->  0.13815 -> 13.8   -> 13
    // 3: sign 0, -7200/45000 = -0.16                    -> -16 (exact in the reals)
    // 4: likes 1: log10(1) = 0, -0.16                   -> -16
    // 5: log10(2) = 0.30103, -86400/45000 = -1.92       -> -1.61897 -> -161.9 -> -162
    expect(scores('BL4', { divisor: 45000 })).toEqual([-2, 13, -16, -16, -162]);
    // posts 3 and 4 tie, so the larger id (4) comes first
    expect(order('BL4', { divisor: 45000 })).toEqual([2, 1, 4, 3, 5]);
  });

  it('BL4: a post with no like has no likes term (sign 0), one like gives log10(1) = 0', () => {
    const s = scorer('BL4');
    const ctx = ctxOf({ divisor: 3600 });
    const p = mkPost(9, U9, null, 1);
    // age 1 h = -3600 s; -3600 / 3600 = -1 -> -100 whatever the likes term is for likes 0 or 1
    expect(s(ctx, p, mkFeatures(p, 0, 3, 3, []))).toBe(-100);
    expect(s(ctx, p, mkFeatures(p, 1, 0, 0, []))).toBe(-100);
  });

  it('BL4 changes the order when the divisor changes', () => {
    // a small divisor makes age count more: divisor 3600 -> (createdAt - t) / 3600 = -age in hours
    // 1: 0.30103 - 4 = -3.69897 -> -369.9 -> -370     2: 0.77815 - 8 = -7.22185 -> -722.2 -> -723
    // 3: -2 -> -200     4: -2 -> -200     5: 0.30103 - 24 = -23.69897 -> -2369.9 -> -2370
    expect(scores('BL4', { divisor: 3600 })).toEqual([-370, -723, -200, -200, -2370]);
    expect(order('BL4', { divisor: 3600 })).toEqual([4, 3, 1, 2, 5]);
  });

  it('BL5 at the published gravity 1.8', () => {
    // likes = 0 -> the lowest band -2^31. Else F(0.8 ln(likes) - 1.8 ln(age + 2)).
    // 1: 0.8 ln 2 - 1.8 ln 6  = 0.55452 - 3.22517 = -2.67065 -> -267.07 -> -268
    // 2: 0.8 ln 6 - 1.8 ln 10 = 1.43341 - 4.14465 = -2.71125 -> -271.1  -> -272
    // 3: no like -> -2147483648
    // 4: 0.8 ln 1 - 1.8 ln 4 = 0 - 2.49533        = -2.49533 -> -249.53 -> -250
    // 5: 0.8 ln 2 - 1.8 ln 26 = 0.55452 - 5.86457  = -5.31006 -> -531.006 -> -532
    expect(scores('BL5', { gravity: 1.8 })).toEqual([-268, -272, -2147483648, -250, -532]);
    expect(order('BL5', { gravity: 1.8 })).toEqual([4, 1, 2, 5, 3]);
  });

  it('BL5: zero likes is the lowest band even for a brand-new post, and below any post with a like', () => {
    const s = scorer('BL5');
    const ctx = ctxOf({ gravity: 1.8 });
    const fresh = mkPost(9, U9, null, 0);
    const old = mkPost(10, U9, null, 168);
    expect(s(ctx, fresh, mkFeatures(fresh, 0, 5, 5, []))).toBe(-(2 ** 31));
    // 0.8 ln 1 - 1.8 ln 170 = -1.8 * 5.13580 = -9.24444 -> -924.4 -> -925
    expect(s(ctx, old, mkFeatures(old, 1, 0, 0, []))).toBe(-925);
  });
});

describe('BL6 (H-follow with every trust weight 1)', () => {
  it('BL6 with alpha 8', () => {
    // F(eng(0.25) + alpha * ([author in F] + |engagedBy and F|))
    // 1: author u2 -> 1, engaged u3 -> 1: 2.  3 + 16 = 19   -> 1900
    // 2: author u9 -> 0, engaged u2, u3 -> 2.  7 + 16 = 23  -> 2300
    // 3: author u3 -> 1, nobody engaged.       -0.5 + 8 = 7.5 -> 750
    // 4: author u9 -> 0, engaged u4 -> 0.      0.5          -> 50
    // 5: author u3 -> 1, engaged u2, u3 -> 2: 3. -4 + 24 = 20 -> 2000
    expect(scores('BL6', { alpha: 8 })).toEqual([1900, 2300, 750, 50, 2000]);
    expect(order('BL6', { alpha: 8 })).toEqual([2, 5, 1, 3, 4]);
  });

  it('BL6 with alpha 0 equals BL2', () => {
    expect(scores('BL6', { alpha: 0 })).toEqual(scores('BL2', {}));
  });

  it('BL6 equals H-follow when every trust weight is 1', () => {
    // One followee u2 whose trust is (n + m / 1) / (N + m) = 1 when n = N, for any m.
    const ufOne: UserFeatures = { followees: [U2], communities: [7], nByAuthor: new Map([[U2, 3]]), nByCommunity: new Map(), nTotal: 3 };
    const ufOneNoHistory: UserFeatures = { followees: [U2], communities: [], nByAuthor: new Map(), nByCommunity: new Map(), nTotal: 0 };
    for (const f of [ufOne, ufOneNoHistory]) {
      for (const alpha of [0, 1, 2, 4, 8, 16]) {
        expect(scores('BL6', { alpha }, f)).toEqual(scores('H-follow', { alpha, m: 5 }, f));
      }
    }
  });
});

describe('H and its ablations', () => {
  // uf: trust(f) = (nByAuthor[f] + m / |F|) / (nTotal + m) = (n + 2) / 14:  trust(u2) = 5/14, trust(u3) = 3/14.
  // community(c) = (nByCommunity[c] + m [c in M] / |M|) / 14:  community(7) = (2 + 4) / 14 = 6/14, community(8) = 0.
  // social per post (author term, then engaged followees):
  //   1: u2 (5/14) + u3 (3/14) = 8/14      2: u2 + u3 = 8/14 (author u9 is no followee)      3: u3 = 3/14
  //   4: 0                                   5: author u3 (3/14) + u2 (5/14) + u3 (3/14) = 11/14
  // alpha = 8, beta = 2.

  it('H: eng(0.25) + 8 social + 2 community', () => {
    // 1: 3 + 8 * 8/14 + 2 * 6/14    = 3 + 4.57143 + 0.85714 = 8.42857  -> 842.857 -> 842
    // 2: 7 + 8 * 8/14               = 7 + 4.57143           = 11.57143 -> 1157.1  -> 1157
    // 3: -0.5 + 8 * 3/14 + 0        = -0.5 + 1.71429        = 1.21429  -> 121.4   -> 121
    // 4: 0.5 + 0 + 2 * 6/14         = 0.5 + 0.85714         = 1.35714  -> 135.7   -> 135
    // 5: -4 + 8 * 11/14 + 2 * 6/14  = -4 + 6.28571 + 0.85714 = 3.14286 -> 314.29  -> 314
    expect(scores('H', HP)).toEqual([842, 1157, 121, 135, 314]);
    expect(order('H', HP)).toEqual([2, 1, 5, 4, 3]);
  });

  it('H-follow: beta = 0', () => {
    // 1: 3 + 4.57143 = 7.57143 -> 757    2: 1157    3: 121    4: 0.5 -> 50    5: -4 + 6.28571 = 2.28571 -> 228
    expect(scores('H-follow', HP)).toEqual([757, 1157, 121, 50, 228]);
    expect(order('H-follow', HP)).toEqual([2, 1, 5, 3, 4]);
  });

  it('H-follow ignores beta, and needs no beta', () => {
    expect(scores('H-follow', { alpha: 8, m: 4 })).toEqual(scores('H-follow', { alpha: 8, beta: 100, m: 4 }));
    expect(scores('H-follow', HP)).toEqual(scores('H', { ...HP, beta: 0 }));
  });

  it('H-comm: alpha = 0', () => {
    // 1: 3 + 0.85714 = 3.85714 -> 385    2: 7 -> 700    3: -0.5 -> -50    4: 0.5 + 0.85714 = 1.35714 -> 135
    // 5: -4 + 0.85714 = -3.14286 -> -314.29 -> -315
    expect(scores('H-comm', HP)).toEqual([385, 700, -50, 135, -315]);
    expect(order('H-comm', HP)).toEqual([2, 1, 4, 3, 5]);
  });

  it('H-comm ignores alpha, and needs no alpha', () => {
    expect(scores('H-comm', { beta: 2, m: 4 })).toEqual(scores('H-comm', { alpha: 100, beta: 2, m: 4 }));
    expect(scores('H-comm', HP)).toEqual(scores('H', { ...HP, alpha: 0 }));
  });

  it('H-noauthor: the sum over engaged followees only', () => {
    // 1: engaged u3 (3/14): 3 + 8 * 3/14 + 2 * 6/14    = 3 + 1.71429 + 0.85714 = 5.57143  -> 557
    // 2: same as H (author u9 is no followee)                                              -> 1157
    // 3: nobody engaged: -0.5 + 0 + 0                                                      -> -50
    // 4: 135 (as H)
    // 5: engaged u2 (5/14) + u3 (3/14) = 8/14: -4 + 4.57143 + 0.85714 = 1.42857 -> 142.86  -> 142
    expect(scores('H-noauthor', HP)).toEqual([557, 1157, -50, 135, 142]);
    expect(order('H-noauthor', HP)).toEqual([2, 1, 5, 4, 3]);
  });

  it('H-noengager: the author term only', () => {
    // 1: author u2 (5/14): 3 + 8 * 5/14 + 2 * 6/14   = 3 + 2.85714 + 0.85714 = 6.71429 -> 671
    // 2: author u9, no term: 7 + 0 + 0                                                 -> 700
    // 3: author u3 (3/14): -0.5 + 1.71429 + 0                                          -> 121
    // 4: 0.5 + 0 + 0.85714 = 1.35714                                                   -> 135
    // 5: author u3 (3/14): -4 + 1.71429 + 0.85714 = -1.42857 -> -142.86                -> -143
    expect(scores('H-noengager', HP)).toEqual([671, 700, 121, 135, -143]);
    expect(order('H-noengager', HP)).toEqual([2, 1, 4, 3, 5]);
  });

  it('H at nTotal = 0: the prior spreads trust equally over followees and over communities', () => {
    // trust(f) = (0 + 4 / 2) / (0 + 4) = 0.5 for each followee.  community(7) = (0 + 4 * 1 / 1) / 4 = 1, community(8) = 0.
    // 1: social 0.5 + 0.5 = 1    -> 3 + 8 + 2 = 13           -> 1300
    // 2: social 0.5 + 0.5 = 1    -> 7 + 8 = 15               -> 1500
    // 3: author u3: 0.5          -> -0.5 + 4 = 3.5           -> 350
    // 4: no social, community 7  -> 0.5 + 2 = 2.5            -> 250
    // 5: author 0.5 + u2 0.5 + u3 0.5 = 1.5 -> -4 + 12 + 2 = 10 -> 1000
    expect(scores('H', HP, ufNoHistory)).toEqual([1300, 1500, 350, 250, 1000]);
    expect(order('H', HP, ufNoHistory)).toEqual([2, 1, 5, 3, 4]);
  });

  it('H with no followee and no community is the engagement score alone (no NaN from 0/0)', () => {
    expect(scores('H', HP, ufEmpty)).toEqual(scores('BL2', {}));
    // history but still no followee and no community
    const ufHist: UserFeatures = { followees: [], communities: [], nByAuthor: new Map([[U9, 4]]), nByCommunity: new Map(), nTotal: 4 };
    expect(scores('H', HP, ufHist)).toEqual(scores('BL2', {}));
  });

  it('H: earlier positives in a community the user is not a member of still count (no prior)', () => {
    // community(7) = (2 + 0) / (10 + 4) = 2/14.  H-comm with beta 2: post 1: 3 + 2 * 2/14 = 3.28571 -> 328.57 -> 328
    const ufNoMember: UserFeatures = { ...uf, communities: [] };
    expect(scores('H-comm', HP, ufNoMember)[0]).toBe(328);
  });

  it('m = 0 with history: trust = nByAuthor / nTotal', () => {
    // trust(u3) = (1 + 0) / (10 + 0) = 1/10. Post 3 (author u3, nobody engaged), alpha 7, no community term:
    // -0.5 + 7 * 1/10 = 0.2 -> 20
    expect(scores('H-follow', { alpha: 7, m: 0 })[2]).toBe(20);
  });

  it('every method at m = 0 with an empty history returns an integer, never NaN (design F5)', () => {
    const all: Array<[MethodId, Record<string, number>]> = [
      ['BL0', {}],
      ['BL1', {}],
      ['BL2', {}],
      ['BL2t', { ageWeight: 0.25 }],
      ['BL3', {}],
      ['BL4', { divisor: 45000 }],
      ['BL5', { gravity: 1.8 }],
      ['BL6', { alpha: 4 }],
      ['H', { alpha: 4, beta: 4, m: 0 }],
      ['H-follow', { alpha: 4, beta: 4, m: 0 }],
      ['H-comm', { alpha: 4, beta: 4, m: 0 }],
      ['H-noauthor', { alpha: 4, beta: 4, m: 0 }],
      ['H-noengager', { alpha: 4, beta: 4, m: 0 }],
    ];
    for (const f of [ufNoHistory, ufEmpty]) {
      for (const [method, params] of all) {
        for (const v of scores(method, params, f)) {
          expect(Number.isNaN(v)).toBe(false);
          expect(Number.isInteger(v)).toBe(true);
        }
      }
    }
    // with m = 0 and no history the trust and community terms are 0, so H is the engagement score alone
    expect(scores('H', { alpha: 4, beta: 4, m: 0 }, ufNoHistory)).toEqual(scores('BL2', {}));
  });

  it('H at alpha = 0 and beta = 0 equals BL2', () => {
    expect(scores('H', { alpha: 0, beta: 0, m: 4 })).toEqual(scores('BL2', {}));
  });

  it('a post with no community has a community term of 0', () => {
    // post 2 has no community: H-comm = F(7) = 700 whatever beta is
    expect(scores('H-comm', { beta: 16, m: 4 })[1]).toBe(700);
  });

  it('the sum runs in engagedBy order, so the same set in the same order gives the same score', () => {
    const s = scorer('H');
    const ctx = ctxOf(HP);
    const pf = features[1];
    const a = s(ctx, posts[1], pf);
    const b = s(ctx, posts[1], { ...pf, engagedBy: [...pf.engagedBy] });
    expect(a).toBe(b);
  });
});

describe('scorer: errors', () => {
  it('throws on an unknown method (design F8)', () => {
    expect(() => scorer('BL9' as MethodId)).toThrow(/unknown method/);
    expect(() => scorer('h' as MethodId)).toThrow(/unknown method/);
    expect(() => scorer('' as MethodId)).toThrow(/unknown method/);
    expect(() => scorer('toString' as MethodId)).toThrow(/unknown method/);
    expect(() => scorer(undefined as unknown as MethodId)).toThrow(/unknown method/);
  });

  it('throws on a missing param, and names it', () => {
    const cases: Array<[MethodId, Record<string, number>, RegExp]> = [
      ['BL2t', {}, /ageWeight/],
      ['BL2t', { ageweight: 0.25 }, /ageWeight/],
      ['BL4', {}, /divisor/],
      ['BL5', {}, /gravity/],
      ['BL6', {}, /alpha/],
      ['H', { beta: 1, m: 1 }, /alpha/],
      ['H', { alpha: 1, m: 1 }, /beta/],
      ['H', { alpha: 1, beta: 1 }, /m/],
      ['H-follow', { m: 1 }, /alpha/],
      ['H-follow', { alpha: 1 }, /m/],
      ['H-comm', { m: 1 }, /beta/],
      ['H-comm', { beta: 1 }, /m/],
      ['H-noauthor', { alpha: 1, beta: 1 }, /m/],
      ['H-noengager', { beta: 1, m: 1 }, /alpha/],
    ];
    for (const [method, params, re] of cases) {
      expect(() => scorer(method)(ctxOf(params), posts[0], features[0])).toThrow(re);
    }
  });

  it('throws on a param that is not a finite number', () => {
    expect(() => scorer('BL4')(ctxOf({ divisor: Number.NaN }), posts[0], features[0])).toThrow(/divisor/);
    expect(() => scorer('BL5')(ctxOf({ gravity: Number.POSITIVE_INFINITY }), posts[0], features[0])).toThrow(/gravity/);
  });

  it('throws instead of returning a score that is not finite', () => {
    // divisor 0 gives -Infinity / NaN
    expect(() => scorer('BL4')(ctxOf({ divisor: 0 }), posts[0], features[0])).toThrow(/finite/);
  });

  it('the methods that need no param run with an empty param object', () => {
    for (const m of ['BL0', 'BL1', 'BL2', 'BL3'] as MethodId[]) {
      expect(() => scorer(m)(ctxOf({}), posts[0], features[0])).not.toThrow();
    }
  });
});

describe('scorers on random fixtures', () => {
  // A small seeded generator, so the test itself is deterministic.
  function lcg(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  it('every scorer returns an integer', () => {
    const rand = lcg(12345);
    const int = (n: number): number => Math.floor(rand() * n);
    const grid = [0, 1, 2, 4, 8, 16];
    const methods: MethodId[] = ['BL0', 'BL1', 'BL2', 'BL2t', 'BL3', 'BL4', 'BL5', 'BL6', 'H', 'H-follow', 'H-comm', 'H-noauthor', 'H-noengager'];
    const ids = Array.from({ length: 12 }, (_, i) => `u${String(i + 1).padStart(10, '0')}`);
    for (let round = 0; round < 300; round++) {
      const nF = int(5);
      const followees = ids.slice(0, nF);
      const nM = int(4);
      const communities = Array.from({ length: nM }, (_, i) => i + 1);
      const nByAuthor = new Map<string, number>();
      for (const f of ids) if (rand() < 0.5) nByAuthor.set(f, int(6));
      const nByCommunity = new Map<number, number>();
      for (let c = 1; c <= 5; c++) if (rand() < 0.5) nByCommunity.set(c, int(6));
      const ufR: UserFeatures = { followees, communities, nByAuthor, nByCommunity, nTotal: int(3) === 0 ? 0 : int(40) };
      const t = 1_000_000 + int(1_000_000);
      const post: Post = {
        id: 1 + int(1000),
        authorId: ids[int(ids.length)],
        communityId: rand() < 0.3 ? null : 1 + int(5),
        createdAt: t - 1 - int(7 * 86400),
        isApproved: true,
        deleted: false,
      };
      const engagedBy = ids.filter(() => rand() < 0.3);
      const pf: PostFeatures = { likes: int(50), comments: int(10), reposts: int(10), createdAt: post.createdAt, engagedBy };
      const params = {
        ageWeight: [0, 0.1, 0.25, 0.5, 1][int(5)],
        divisor: [1000, 22500, 45000, 90000][int(4)],
        gravity: [1, 1.5, 1.8, 2.5][int(4)],
        alpha: grid[int(grid.length)],
        beta: grid[int(grid.length)],
        m: [0, 2, 5, 10][int(4)],
      };
      const ctx: ScoreContext = { user: ids[0], asOf: { t, beforeEventId: int(100) }, uf: ufR, params };
      for (const method of methods) {
        const v = scorer(method)(ctx, post, pf);
        expect(Number.isInteger(v)).toBe(true);
      }
    }
  });
});
