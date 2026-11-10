import {
  commentToPositive,
  followToFeature,
  groupByPost,
  likeToPositive,
  membershipToFeature,
  postToCandidate,
  repostToPositive,
  toSec,
  windowBounds,
} from './feed.mapping';

describe('feed mapping (TC3)', () => {
  describe('toSec', () => {
    it('rounds down to whole seconds', () => {
      expect(toSec(new Date(1999))).toBe(1);
      expect(toSec(new Date(2000))).toBe(2);
      expect(toSec(new Date(2001))).toBe(2);
      expect(toSec(new Date(0))).toBe(0);
    });
  });

  describe('windowBounds', () => {
    it('F2: gives gte (t - W) * 1000 and lt t * 1000, in ms', () => {
      const b = windowBounds(1_000_000, 604_800);
      expect(b.gte.getTime()).toBe((1_000_000 - 604_800) * 1000);
      expect(b.lt.getTime()).toBe(1_000_000 * 1000);
    });

    it('keeps a post at 999 ms below t and drops one at t', () => {
      const b = windowBounds(100, 50);
      const inWindow = (ms: number) => ms >= b.gte.getTime() && ms < b.lt.getTime();
      expect(inWindow(50_000)).toBe(true);
      expect(inWindow(49_999)).toBe(false);
      expect(inWindow(99_999)).toBe(true);
      expect(inWindow(100_000)).toBe(false);
    });
  });

  describe('row mappers', () => {
    it('postToCandidate gives the package Post', () => {
      const row = {
        id: 7,
        userId: 'u1',
        communityId: 4,
        createdAt: new Date(12_345),
        isApproved: false,
        deletedAt: new Date(20_000),
      };
      expect(postToCandidate(row)).toEqual({
        id: 7,
        authorId: 'u1',
        communityId: 4,
        createdAt: 12,
        isApproved: false,
        deleted: true,
      });
      expect(postToCandidate({ ...row, communityId: null, isApproved: true, deletedAt: null })).toEqual({
        id: 7,
        authorId: 'u1',
        communityId: null,
        createdAt: 12,
        isApproved: true,
        deleted: false,
      });
    });

    it('a like, a comment and a repost row become a Positive of the right type and post', () => {
      expect(likeToPositive({ id: 1, userId: 'u1', postId: 10, createdAt: new Date(5_999) })).toEqual({
        id: 1,
        userId: 'u1',
        postId: 10,
        type: 'like',
        t: 5,
      });
      expect(commentToPositive({ id: 2, userId: 'u2', postId: 11, createdAt: new Date(6_000) })).toEqual({
        id: 2,
        userId: 'u2',
        postId: 11,
        type: 'comment',
        t: 6,
      });
      // The repost row is a Post: its own id and its rePostId (the touched post).
      expect(repostToPositive({ id: 900, userId: 'u3', rePostId: 12, createdAt: new Date(7_000) })).toEqual({
        id: 900,
        userId: 'u3',
        postId: 12,
        type: 'repost',
        t: 7,
      });
    });

    it('repostToPositive refuses a row without rePostId', () => {
      expect(() => repostToPositive({ id: 1, userId: 'u', rePostId: null, createdAt: new Date(0) })).toThrow(/rePostId/);
    });

    it('follow and membership rows become the package types', () => {
      expect(followToFeature({ followerId: 'a', followingId: 'b', createdAt: new Date(3_500) })).toEqual({
        followerId: 'a',
        followeeId: 'b',
        t: 3,
      });
      expect(membershipToFeature({ userId: 'a', communityId: 9, createdAt: new Date(4_999) })).toEqual({
        userId: 'a',
        communityId: 9,
        t: 4,
      });
    });
  });

  describe('groupByPost', () => {
    it('groups by post and keeps the input order inside a group', () => {
      const p = (id: number, postId: number) => ({ id, userId: 'u', postId, type: 'like' as const, t: id });
      const g = groupByPost([p(1, 10), p(2, 11), p(3, 10)]);
      expect([...g.keys()]).toEqual([10, 11]);
      expect(g.get(10)?.map((x) => x.id)).toEqual([1, 3]);
      expect(g.get(11)?.map((x) => x.id)).toEqual([2]);
    });

    it('gives an empty map for no positives', () => {
      expect(groupByPost([]).size).toBe(0);
    });
  });
});
