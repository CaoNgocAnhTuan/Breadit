import { readFileSync } from 'fs';
import * as path from 'path';
import { scorer, type Post, type PostFeatures, type UserFeatures } from '@breadit/ranking';
import { FEED_ALGOS } from './feed.config';
import { ALGO_METHOD, POOL_PARAMS, PRIOR_M, SOCIAL_PARAMS, methodParams } from './feed.constants';

// The frozen values of super-plan section 7, as eval/config/frozen-v1.json holds them.
const frozen = JSON.parse(
  readFileSync(path.resolve(__dirname, '../../../../eval/config/frozen-v1.json'), 'utf8'),
) as {
  windowDays: number;
  poolCap: number;
  priorStrength: number;
  alphaBetaGrid: number[];
};

describe('feed constants (TC2)', () => {
  it('W and N_max equal frozen-v1.json', () => {
    expect(POOL_PARAMS.windowSec).toBe(frozen.windowDays * 86400);
    expect(POOL_PARAMS.maxPosts).toBe(frozen.poolCap);
  });

  it('m equals the prior strength of frozen-v1.json', () => {
    expect(PRIOR_M).toBe(frozen.priorStrength);
  });

  it('alpha and beta of the placeholder are in the grid of section 7', () => {
    expect(frozen.alphaBetaGrid).toContain(SOCIAL_PARAMS.alpha);
    expect(frozen.alphaBetaGrid).toContain(SOCIAL_PARAMS.beta);
  });

  it('maps chrono to BL0, engagement to BL2 and social to H', () => {
    expect(ALGO_METHOD).toEqual({ chrono: 'BL0', engagement: 'BL2', social: 'H' });
  });

  it('methodParams: social gets alpha, beta and m; the other two get none', () => {
    expect(methodParams('social')).toEqual({ alpha: SOCIAL_PARAMS.alpha, beta: SOCIAL_PARAMS.beta, m: PRIOR_M });
    expect(methodParams('chrono')).toEqual({});
    expect(methodParams('engagement')).toEqual({});
  });

  it('F19: each algo scores a sample post to a finite integer', () => {
    const post: Post = { id: 9, authorId: 'u0000000002', communityId: 3, createdAt: 1000, isApproved: true, deleted: false };
    const pf: PostFeatures = { likes: 2, comments: 1, reposts: 1, createdAt: 1000, engagedBy: ['u0000000002'] };
    const uf: UserFeatures = {
      followees: ['u0000000002'],
      communities: [3],
      nByAuthor: new Map([['u0000000002', 2]]),
      nByCommunity: new Map([[3, 1]]),
      nTotal: 4,
    };
    for (const algo of FEED_ALGOS) {
      const score = scorer(ALGO_METHOD[algo])(
        { user: 'u0000000001', asOf: { t: 5000 }, uf, params: methodParams(algo) },
        post,
        pf,
      );
      expect(Number.isInteger(score)).toBe(true);
      expect(Number.isFinite(score)).toBe(true);
    }
  });
});
