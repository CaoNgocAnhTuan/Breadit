// Tests of scripts/demo/lib.mjs (task p10-demo-script, plan steps 1-2, TC1-TC6).
// Run: node --test scripts/demo/   (Node 22, no db, no Redis)
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feedIds, orderCandidates, overlap, pagesNotAllSame, pickUser, rebaseIso } from './lib.mjs';

const LOADER_FORMAT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

// TC1: rebaseIso
test('TC1 rebaseIso cuts a Date with milliseconds down to the second, in UTC', () => {
  assert.equal(rebaseIso(new Date('2026-11-22T10:15:30.999Z')), '2026-11-22T10:15:30Z');
  assert.equal(rebaseIso(new Date('2026-11-22T10:15:30.000Z')), '2026-11-22T10:15:30Z');
  assert.equal(rebaseIso(new Date('2026-11-22T10:15:30.001Z')), '2026-11-22T10:15:30Z');
});

test('TC1 rebaseIso does not round up over a day or a year border', () => {
  assert.equal(rebaseIso(new Date('2026-11-22T23:59:59.999Z')), '2026-11-22T23:59:59Z');
  assert.equal(rebaseIso(new Date('2026-12-31T23:59:59.500Z')), '2026-12-31T23:59:59Z');
});

test('TC1 rebaseIso gives the format of the loader, also for an offset date', () => {
  const d = new Date('2026-11-22T12:00:00.123+07:00'); // 05:00:00.123 UTC
  assert.equal(rebaseIso(d), '2026-11-22T05:00:00Z');
  assert.match(rebaseIso(d), LOADER_FORMAT);
  assert.match(rebaseIso(new Date(0)), LOADER_FORMAT);
  assert.equal(rebaseIso(new Date(0)), '1970-01-01T00:00:00Z');
});

// TC2: feedIds
test('TC2 feedIds returns the ids of posts in order', () => {
  const body = { posts: [{ id: 30, desc: 'a' }, { id: 7 }, { id: 21 }], hasMore: true, nextCursor: 'x' };
  assert.deepEqual(feedIds(body), [30, 7, 21]);
});

test('TC2 feedIds gives [] for an empty page', () => {
  assert.deepEqual(feedIds({ posts: [], hasMore: false, nextCursor: null }), []);
});

test('TC2 feedIds throws when the body has no posts array', () => {
  assert.throws(() => feedIds({}), /posts/);
  assert.throws(() => feedIds({ posts: 'nope' }), /posts/);
  assert.throws(() => feedIds(null), /posts/);
  assert.throws(() => feedIds({ message: 'Unauthorized', statusCode: 401 }), /posts/);
});

// TC3: pagesNotAllSame
test('TC3 pagesNotAllSame is false when all lists are equal', () => {
  const a = [1, 2, 3];
  assert.equal(pagesNotAllSame([a, [...a], [...a]]), false);
});

test('TC3 pagesNotAllSame is true when two are equal and one is different', () => {
  assert.equal(pagesNotAllSame([[1, 2, 3], [1, 2, 3], [1, 2, 4]]), true);
  assert.equal(pagesNotAllSame([[1, 2, 4], [1, 2, 3], [1, 2, 3]]), true);
});

test('TC3 pagesNotAllSame is true when all three are different', () => {
  assert.equal(pagesNotAllSame([[1, 2, 3], [4, 5, 6], [7, 8, 9]]), true);
});

test('TC3 pagesNotAllSame sees the same ids in another order as different', () => {
  assert.equal(pagesNotAllSame([[1, 2, 3], [3, 2, 1], [1, 2, 3]]), true);
});

// TC4: overlap
test('TC4 overlap counts the shared ids, in any order', () => {
  assert.equal(overlap([1, 2, 3], [4, 5, 6]), 0);
  assert.equal(overlap([1, 2, 3, 4], [4, 9, 2, 8]), 2);
  assert.equal(overlap([1, 2, 3], [3, 1, 2]), 3);
  assert.equal(overlap([], [1, 2]), 0);
});

// TC5: orderCandidates
const row = (id, history, follows) => ({ id, history, follows });

test('TC5 orderCandidates little keeps history 1-4 only', () => {
  const rows = [row('a', 0, 5), row('b', 1, 5), row('c', 4, 5), row('d', 5, 5), row('e', 20, 5)];
  assert.deepEqual(orderCandidates(rows, 'little').map((r) => r.id), ['b', 'c']);
});

test('TC5 orderCandidates long keeps history 20 and more only', () => {
  const rows = [row('a', 19, 5), row('b', 20, 5), row('c', 500, 5), row('d', 4, 5)];
  assert.deepEqual(orderCandidates(rows, 'long').map((r) => r.id), ['b', 'c']);
});

test('TC5 orderCandidates drops a follow count of 0 in both groups', () => {
  const rows = [row('a', 2, 0), row('b', 3, 1), row('c', 25, 0), row('d', 30, 1)];
  assert.deepEqual(orderCandidates(rows, 'little').map((r) => r.id), ['b']);
  assert.deepEqual(orderCandidates(rows, 'long').map((r) => r.id), ['d']);
});

test('TC5 orderCandidates sorts by follow count (high first), then id (low first)', () => {
  const rows = [row('u3', 2, 7), row('u1', 3, 9), row('u9', 1, 9), row('u2', 4, 7), row('u5', 2, 12)];
  assert.deepEqual(orderCandidates(rows, 'little').map((r) => r.id), ['u5', 'u1', 'u9', 'u2', 'u3']);
});

test('TC5 orderCandidates does not change its input and is repeatable', () => {
  const rows = [row('u2', 25, 3), row('u1', 30, 3)];
  const copy = JSON.parse(JSON.stringify(rows));
  const first = orderCandidates(rows, 'long');
  assert.deepEqual(rows, copy);
  assert.deepEqual(orderCandidates(copy, 'long'), first);
});

test('TC5 orderCandidates refuses an unknown group', () => {
  assert.throws(() => orderCandidates([], 'medium'), /group/);
});

// TC6: pickUser
test('TC6 pickUser returns the first candidate that passes', async () => {
  const calls = [];
  const r = await pickUser(['a', 'b', 'c'], async (c) => {
    calls.push(c);
    return c === 'b' ? { ok: true, pages: [c] } : { ok: false, reason: `${c} is flat` };
  });
  assert.equal(r.chosen, 'b');
  assert.deepEqual(r.result, { ok: true, pages: ['b'] });
  assert.deepEqual(calls, ['a', 'b']);
  assert.deepEqual(r.skipped, [{ candidate: 'a', reason: 'a is flat' }]);
});

test('TC6 pickUser lists every skipped candidate with its reason', async () => {
  const r = await pickUser(['a', 'b', 'c'], async (c) => (c === 'c' ? { ok: true } : { ok: false, reason: `no ${c}` }));
  assert.equal(r.chosen, 'c');
  assert.deepEqual(r.skipped, [
    { candidate: 'a', reason: 'no a' },
    { candidate: 'b', reason: 'no b' },
  ]);
});

test('TC6 pickUser tries at most max (default 4) and returns none after that', async () => {
  const calls = [];
  const r = await pickUser(['a', 'b', 'c', 'd', 'e', 'f'], async (c) => {
    calls.push(c);
    return { ok: false, reason: 'flat' };
  });
  assert.equal(r.chosen, null);
  assert.equal(r.result, null);
  assert.deepEqual(calls, ['a', 'b', 'c', 'd']); // never a fifth login
  assert.equal(r.skipped.length, 4);
});

test('TC6 pickUser respects a smaller max and an empty list', async () => {
  const calls = [];
  const r = await pickUser(['a', 'b', 'c'], async (c) => {
    calls.push(c);
    return { ok: false, reason: 'x' };
  }, 2);
  assert.equal(r.chosen, null);
  assert.deepEqual(calls, ['a', 'b']);
  const none = await pickUser([], async () => ({ ok: true }));
  assert.equal(none.chosen, null);
  assert.deepEqual(none.skipped, []);
});

test('TC6 pickUser takes the fourth candidate when it is the first that passes', async () => {
  const r = await pickUser(['a', 'b', 'c', 'd', 'e'], async (c) => (c === 'd' ? { ok: true } : { ok: false, reason: 'flat' }));
  assert.equal(r.chosen, 'd');
  assert.equal(r.skipped.length, 3);
});
