import { Injectable } from '@nestjs/common';
import {
  buildPool,
  postFeaturesAsOf,
  rankPool,
  scorer,
  userFeaturesAsOf,
  type AsOf,
  type Positive,
  type PostFeatures,
  type PostId,
  type PostInfo,
  type Sec,
  type UserId,
} from '@breadit/ranking';
import { BlockService } from '../block/block.service';
import { PrismaService } from '../prisma/prisma.service';
import type { FeedAlgo } from './feed.config';
import { ALGO_METHOD, POOL_PARAMS, methodParams } from './feed.constants';
import {
  commentToPositive,
  followToFeature,
  groupByPost,
  likeToPositive,
  membershipToFeature,
  postToCandidate,
  repostToPositive,
  windowBounds,
} from './feed.mapping';

export interface RankedPost {
  id: PostId;
  /** The scoreFixed of the method. Its order is `rankPool`'s order: (score desc, id desc). */
  score: number;
}

// The author and community of the post a positive touches. A like and a comment join it through `post`, and a repost
// row through `rePost`.
const TOUCHED = { select: { userId: true, communityId: true } } as const;

/**
 * The feed module (blueprint section 1). It loads plain arrays from Prisma and calls @breadit/ranking. It has no ranking
 * logic of its own and it never reads the clock: the time is the argument `asOfSec`.
 */
@Injectable()
export class FeedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blockService: BlockService,
  ) {}

  /** The whole ranked pool of `userId` at `asOfSec`, best first. */
  async rank(userId: UserId, algo: FeedAlgo, asOfSec: Sec): Promise<RankedPost[]> {
    const asOf: AsOf = { t: asOfSec };
    const before = new Date(asOfSec * 1000); // createdAt < before  <=>  floor(createdAt / 1000) < asOfSec

    // 1. Candidates: the root posts of the window, community posts included, repost rows left out. No `take`: only
    //    buildPool applies N_max. Deleted and pending posts are selected, and buildPool drops them (R2).
    const { gte, lt } = windowBounds(asOfSec, POOL_PARAMS.windowSec);
    const candidateRows = await this.prisma.post.findMany({
      where: { parentPostId: null, rePostId: null, createdAt: { gte, lt } },
      select: { id: true, userId: true, communityId: true, createdAt: true, isApproved: true, deletedAt: true },
    });
    const candidates = candidateRows.map(postToCandidate);

    // 2. The user's follows, memberships and positives before t (the rules of engagementSelect).
    const [followRows, memberRows, myLikes, myComments, myReposts] = await Promise.all([
      this.prisma.follow.findMany({
        where: { followerId: userId },
        select: { followerId: true, followingId: true, createdAt: true },
      }),
      this.prisma.communityMember.findMany({
        where: { userId },
        select: { userId: true, communityId: true, createdAt: true },
      }),
      this.prisma.like.findMany({
        where: { userId, createdAt: { lt: before } },
        select: { id: true, userId: true, postId: true, createdAt: true, post: TOUCHED },
      }),
      this.prisma.comment.findMany({
        where: { userId, deletedAt: null, createdAt: { lt: before } },
        select: { id: true, userId: true, postId: true, createdAt: true, post: TOUCHED },
      }),
      this.prisma.post.findMany({
        where: { userId, rePostId: { not: null }, deletedAt: null, createdAt: { lt: before } },
        select: { id: true, userId: true, rePostId: true, createdAt: true, rePost: TOUCHED },
      }),
    ]);
    const positives: Positive[] = [
      ...myLikes.map(likeToPositive),
      ...myComments.map(commentToPositive),
      ...myReposts.map(repostToPositive),
    ];
    const postInfo = new Map<PostId, PostInfo>();
    for (const l of [...myLikes, ...myComments]) postInfo.set(l.postId, { authorId: l.post.userId, communityId: l.post.communityId });
    for (const r of myReposts) {
      if (r.rePost !== null && r.rePostId !== null) {
        postInfo.set(r.rePostId, { authorId: r.rePost.userId, communityId: r.rePost.communityId });
      }
    }

    // 3. The blocked peers.
    const blocked = await this.blockService.getAllBlockedPeerIds(userId);

    // 4. The user features and the pool, from the package.
    const uf = userFeaturesAsOf(userId, asOf, {
      follows: followRows.map(followToFeature),
      memberships: memberRows.map(membershipToFeature),
      positives,
      postInfo,
    });
    const pool = buildPool(
      {
        user: userId,
        asOf,
        candidates,
        blocked,
        earlierPositives: new Set(positives.map((p) => p.postId)),
      },
      POOL_PARAMS,
    );
    if (pool.length === 0) return [];

    // 5. The positives on the pool posts only, grouped by post.
    const ids = pool.map((p) => p.id);
    const [likes, comments, reposts] = await Promise.all([
      this.prisma.like.findMany({
        where: { postId: { in: ids }, createdAt: { lt: before } },
        select: { id: true, userId: true, postId: true, createdAt: true },
      }),
      this.prisma.comment.findMany({
        where: { postId: { in: ids }, deletedAt: null, createdAt: { lt: before } },
        select: { id: true, userId: true, postId: true, createdAt: true },
      }),
      this.prisma.post.findMany({
        where: { rePostId: { in: ids }, deletedAt: null, createdAt: { lt: before } },
        select: { id: true, userId: true, rePostId: true, createdAt: true },
      }),
    ]);
    const byPost = groupByPost([
      ...likes.map(likeToPositive),
      ...comments.map(commentToPositive),
      ...reposts.map(repostToPositive),
    ]);
    const feats = new Map<PostId, PostFeatures>();
    for (const post of pool) feats.set(post.id, postFeaturesAsOf(post, asOf, byPost.get(post.id) ?? []));

    // 6. The scorer of the algo and rankPool. The score function keeps each score for the cursor.
    const score = scorer(ALGO_METHOD[algo]);
    const ctx = { user: userId, asOf, uf, params: methodParams(algo) };
    const scores = new Map<PostId, number>();
    const order = rankPool(pool, (post) => {
      const s = score(ctx, post, feats.get(post.id) as PostFeatures);
      scores.set(post.id, s);
      return s;
    });
    return order.map((id) => ({ id, score: scores.get(id) as number }));
  }
}
