import { postFeaturesAsOf } from "@breadit/ranking";
import type { AsOf, Positive, Post, PostFeatures, PostId, UserFeatureData, UserId } from "@breadit/ranking";
import type { Dataset } from "../canonical/dataset.ts";
import { postCounts, uid, userFollows, userMemberships, userPositives } from "./index-data.ts";
import type { DataIndex } from "./index-data.ts";

// Post features for the harness (design "One fast path"). The fast path keeps what the scorers read: the three counts, and
// `engagedBy` limited to the user's followees. Every scorer reads `engagedBy` only through its intersection with the
// followees (BL6, H and its ablations), so the scores are the same as with the package's `postFeaturesAsOf`.

/** Fast `PostFeatures` of a post. `engaged` comes from `followeeEngagement` for the same user and asOf. */
export function fastPostFeatures(
  post: Pick<Post, "id" | "createdAt">,
  asOf: AsOf,
  engaged: ReadonlyMap<PostId, UserId[]>,
  idx: DataIndex,
): PostFeatures {
  const c = postCounts(idx, post.id, asOf);
  return { likes: c.likes, comments: c.comments, reposts: c.reposts, createdAt: post.createdAt, engagedBy: engaged.get(post.id) ?? [] };
}

/** The reference mode: the package function, unchanged, over every positive of the dataset. */
export function referencePostFeatures(post: Pick<Post, "id" | "createdAt">, asOf: AsOf, all: readonly Positive[]): PostFeatures {
  return postFeaturesAsOf(post, asOf, all);
}

/** Every positive of the dataset as a package `Positive` (reference mode and tests). */
export function referencePositives(data: Pick<Dataset, "interactions">): Positive[] {
  return data.interactions.map((e) => ({ id: e.eventId, userId: uid(e.userId), postId: e.postId, type: e.type, t: e.createdAt }));
}

/**
 * The data `userFeaturesAsOf` needs for one user: only this user's follows, memberships and positives. The function filters
 * by user anyway, and by time (strictly before asOf.t for follows and memberships, the AsOf rule for positives).
 */
export function userFeatureData(idx: DataIndex, user: number): UserFeatureData {
  return {
    follows: userFollows(idx, user),
    memberships: userMemberships(idx, user),
    positives: userPositives(idx, user),
    postInfo: idx.postInfo,
  };
}
