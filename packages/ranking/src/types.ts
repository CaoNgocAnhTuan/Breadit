// The types of blueprint 2.6 (H-c). Signatures are fixed: the harness and the feed module both call them.
// A user id is a string, `u` plus the integer padded to 10 digits (blueprint 2.5). Compare ids with `<`, never localeCompare.

export type UserId = string;
export type PostId = number;
/** Integer seconds. */
export type Sec = number;

export interface AsOf {
  t: Sec;
  beforeEventId?: number;
}
// An event e is visible at asOf iff e.t < asOf.t, or e.t === asOf.t and e.id < asOf.beforeEventId.
// The harness passes the test event's id. The live app passes no id (strictly before t).

export interface Post {
  id: PostId;
  authorId: UserId;
  communityId: number | null;
  createdAt: Sec;
  isApproved: boolean;
  deleted: boolean;
}

export interface Positive {
  id: number;
  userId: UserId;
  postId: PostId;
  type: 'like' | 'comment' | 'repost';
  t: Sec;
}

/** Values: super-plan section 7, "Window W / pool cap N_max". */
export interface PoolParams {
  windowSec: number;
  maxPosts: number;
}

export interface UserFeatures {
  /** Distinct, sorted. */
  followees: UserId[];
  /** Distinct, sorted. */
  communities: number[];
  nByAuthor: ReadonlyMap<UserId, number>;
  nByCommunity: ReadonlyMap<number, number>;
  nTotal: number;
}

export interface PostFeatures {
  likes: number;
  comments: number;
  reposts: number;
  createdAt: Sec;
  /** Distinct, sorted. */
  engagedBy: UserId[];
}

export type MethodId =
  | 'BL0'
  | 'BL1'
  | 'BL2'
  | 'BL2t'
  | 'BL3'
  | 'BL4'
  | 'BL5'
  | 'BL6'
  | 'H'
  | 'H-follow'
  | 'H-comm'
  | 'H-noauthor'
  | 'H-noengager';

export interface ScoreContext {
  user: UserId;
  asOf: AsOf;
  uf: UserFeatures;
  params: Readonly<Record<string, number>>;
}

/** Returns scoreFixed, an integer. */
export type Scorer = (ctx: ScoreContext, post: Post, pf: PostFeatures) => number;
