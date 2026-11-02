import { postFeaturesAsOf, userFeaturesAsOf } from './features';
import type { UserFeatureData } from './features';
import type { AsOf, Positive, PostId } from './types';

const U1 = 'u0000000001';
const U2 = 'u0000000002';
const U3 = 'u0000000003';
const U4 = 'u0000000004';
const U5 = 'u0000000005';
const U10 = 'u0000000010';

const asOf: AsOf = { t: 1000, beforeEventId: 20 };
const asOfNoId: AsOf = { t: 1000 };

// Posts: 1 by U2 (community 7), 2 by U2 (no community), 3 by U3 (community 7), 4 by U4 (community 8).
const postInfo: ReadonlyMap<PostId, { authorId: string; communityId: number | null }> = new Map([
  [1, { authorId: U2, communityId: 7 }],
  [2, { authorId: U2, communityId: null }],
  [3, { authorId: U3, communityId: 7 }],
  [4, { authorId: U4, communityId: 8 }],
]);

const pos = (id: number, userId: string, postId: number, t: number, type: Positive['type'] = 'like'): Positive => ({
  id,
  userId,
  postId,
  type,
  t,
});

function baseData(): UserFeatureData {
  return {
    follows: [
      { followerId: U1, followeeId: U3, t: 100 },
      { followerId: U1, followeeId: U2, t: 200 },
      { followerId: U1, followeeId: U2, t: 300 }, // a duplicate pair: still one followee
      { followerId: U1, followeeId: U10, t: 999 },
      { followerId: U1, followeeId: U4, t: 1000 }, // at asOf.t: out (design F10)
      { followerId: U1, followeeId: U5, t: 1500 }, // after: out
      { followerId: U2, followeeId: U1, t: 100 }, // another user's follow
    ],
    memberships: [
      { userId: U1, communityId: 8, t: 50 },
      { userId: U1, communityId: 7, t: 60 },
      { userId: U1, communityId: 7, t: 70 }, // duplicate
      { userId: U1, communityId: 9, t: 1000 }, // at asOf.t: out
      { userId: U1, communityId: 10, t: 2000 }, // after: out
      { userId: U2, communityId: 11, t: 10 }, // another user
    ],
    positives: [
      pos(1, U1, 1, 500), // author U2, community 7
      pos(2, U1, 2, 600, 'comment'), // author U2, no community
      pos(3, U1, 3, 700, 'repost'), // author U3, community 7
      pos(4, U1, 3, 800), // author U3, community 7
      pos(19, U1, 4, 1000), // at asOf.t, id 19 < 20: visible. author U4, community 8
      pos(20, U1, 4, 1000), // at asOf.t, id 20 not < 20: out
      pos(30, U1, 1, 1001), // after: out
      pos(5, U2, 1, 100), // another user
      pos(6, U1, 99, 900), // a post that is not in postInfo: counts in nTotal only
    ],
    postInfo,
  };
}

describe('userFeaturesAsOf', () => {
  it('collects followees and communities dated before asOf.t, distinct and sorted', () => {
    const uf = userFeaturesAsOf(U1, asOf, baseData());
    expect(uf.followees).toEqual([U2, U3, U10]);
    expect(uf.communities).toEqual([7, 8]);
  });

  it('a follow or membership at exactly asOf.t is out, even when asOf has an event id', () => {
    const uf = userFeaturesAsOf(U1, asOf, baseData());
    expect(uf.followees).not.toContain(U4);
    expect(uf.communities).not.toContain(9);
    const ufNoId = userFeaturesAsOf(U1, asOfNoId, baseData());
    expect(ufNoId.followees).toEqual([U2, U3, U10]);
    expect(ufNoId.communities).toEqual([7, 8]);
  });

  it('sorts numeric community ids as numbers, not as text', () => {
    const data: UserFeatureData = {
      follows: [],
      memberships: [2, 10, 1, 33].map((communityId, i) => ({ userId: U1, communityId, t: i })),
      positives: [],
      postInfo: new Map(),
    };
    expect(userFeaturesAsOf(U1, asOf, data).communities).toEqual([1, 2, 10, 33]);
  });

  it('counts only the visible positives of the user, by author and by community', () => {
    const uf = userFeaturesAsOf(U1, asOf, baseData());
    // visible: ids 1, 2, 3, 4, 19, 6. Id 20 and 30 are out. Id 5 is another user's.
    expect(uf.nTotal).toBe(6);
    expect([...uf.nByAuthor.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))).toEqual([
      [U2, 2],
      [U3, 2],
      [U4, 1],
    ]);
    expect([...uf.nByCommunity.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [7, 3],
      [8, 1],
    ]);
  });

  it('without an event id, the positive at exactly asOf.t is out', () => {
    const uf = userFeaturesAsOf(U1, asOfNoId, baseData());
    expect(uf.nTotal).toBe(5);
    expect(uf.nByAuthor.get(U4)).toBeUndefined();
  });

  it('gives empty features for a user with no data', () => {
    const uf = userFeaturesAsOf(U5, asOf, baseData());
    expect(uf.followees).toEqual([]);
    expect(uf.communities).toEqual([]);
    expect(uf.nTotal).toBe(0);
    expect(uf.nByAuthor.size).toBe(0);
    expect(uf.nByCommunity.size).toBe(0);
  });

  it('is not changed by any event after asOf', () => {
    const before = userFeaturesAsOf(U1, asOf, baseData());
    const data = baseData();
    const later: UserFeatureData = {
      follows: [...data.follows, { followerId: U1, followeeId: U5, t: 1000 }, { followerId: U1, followeeId: U10, t: 5000 }],
      memberships: [...data.memberships, { userId: U1, communityId: 12, t: 1000 }, { userId: U1, communityId: 13, t: 6000 }],
      positives: [
        ...data.positives,
        pos(21, U1, 1, 1000),
        pos(22, U1, 2, 1000, 'comment'),
        pos(100, U1, 3, 1001),
        pos(101, U1, 4, 99999, 'repost'),
      ],
      postInfo: data.postInfo,
    };
    const after = userFeaturesAsOf(U1, asOf, later);
    expect(after).toEqual(before);
  });

  it('does not depend on the order of the input arrays', () => {
    const data = baseData();
    const reversed: UserFeatureData = {
      follows: [...data.follows].reverse(),
      memberships: [...data.memberships].reverse(),
      positives: [...data.positives].reverse(),
      postInfo: data.postInfo,
    };
    expect(userFeaturesAsOf(U1, asOf, reversed)).toEqual(userFeaturesAsOf(U1, asOf, data));
  });
});

describe('postFeaturesAsOf', () => {
  const post = { id: 1, createdAt: 400 };
  const positives: Positive[] = [
    pos(1, U3, 1, 500, 'like'),
    pos(2, U2, 1, 510, 'like'),
    pos(3, U3, 1, 520, 'comment'), // U3 again: still one in engagedBy
    pos(4, U10, 1, 530, 'repost'),
    pos(5, U1, 1, 540, 'like'),
    pos(6, U4, 1, 1000, 'like'), // at asOf.t, id 6 < 20: visible
    pos(20, U5, 1, 1000, 'like'), // at asOf.t, id 20 not < 20: out
    pos(40, U5, 1, 1001, 'comment'), // after: out
    pos(7, U2, 2, 500, 'like'), // another post
  ];

  it('counts visible likes, comments and reposts of the post', () => {
    const pf = postFeaturesAsOf(post, asOf, positives);
    expect(pf.likes).toBe(4); // ids 1, 2, 5, 6
    expect(pf.comments).toBe(1); // id 3
    expect(pf.reposts).toBe(1); // id 4
    expect(pf.createdAt).toBe(400);
  });

  it('engagedBy is distinct and sorted', () => {
    const pf = postFeaturesAsOf(post, asOf, positives);
    expect(pf.engagedBy).toEqual([U1, U2, U3, U4, U10]);
  });

  it('without an event id, the positive at exactly asOf.t is out', () => {
    const pf = postFeaturesAsOf(post, asOfNoId, positives);
    expect(pf.likes).toBe(3);
    expect(pf.engagedBy).toEqual([U1, U2, U3, U10]);
  });

  it('gives zeros and an empty list for a post with no positive', () => {
    const pf = postFeaturesAsOf({ id: 77, createdAt: 5 }, asOf, positives);
    expect(pf).toEqual({ likes: 0, comments: 0, reposts: 0, createdAt: 5, engagedBy: [] });
  });

  it('is not changed by any event after asOf', () => {
    const before = postFeaturesAsOf(post, asOf, positives);
    const after = postFeaturesAsOf(post, asOf, [
      ...positives,
      pos(21, U5, 1, 1000, 'repost'),
      pos(500, U10, 1, 1002, 'like'),
      pos(501, U2, 1, 90000, 'comment'),
    ]);
    expect(after).toEqual(before);
  });

  it('does not depend on the order of the input array', () => {
    expect(postFeaturesAsOf(post, asOf, [...positives].reverse())).toEqual(postFeaturesAsOf(post, asOf, positives));
  });
});
