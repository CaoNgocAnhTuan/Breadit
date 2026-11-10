import { BadRequestException } from '@nestjs/common';
import { makeAlgoCursor, pageAfter, parseAlgoCursor } from './feed.cursor';

const NOW = 1_800_000_000;

describe('parseAlgoCursor (TC4)', () => {
  it('"1" is the first page: t is the clock when there is no asOf', () => {
    expect(parseAlgoCursor('1', NOW, null)).toEqual({ t: NOW, after: null });
  });

  it('"1" with asOf: t is asOf', () => {
    expect(parseAlgoCursor('1', NOW, 1_700_000_000)).toEqual({ t: 1_700_000_000, after: null });
  });

  it('reads t:score:id, and the score may be negative', () => {
    expect(parseAlgoCursor(`${NOW - 10}:-250:42`, NOW, null)).toEqual({
      t: NOW - 10,
      after: { score: -250, id: 42 },
    });
    expect(parseAlgoCursor(`${NOW}:5000000000:7`, NOW, null)).toEqual({
      t: NOW,
      after: { score: 5_000_000_000, id: 7 },
    });
  });

  it('F10: without asOf, t in the future is 400', () => {
    expect(() => parseAlgoCursor(`${NOW + 1}:1:1`, NOW, null)).toThrow(BadRequestException);
  });

  it('F10: without asOf, t older than 24 h is 400, and exactly 24 h is fine', () => {
    expect(() => parseAlgoCursor(`${NOW - 86_400 - 1}:1:1`, NOW, null)).toThrow(/expired/);
    expect(parseAlgoCursor(`${NOW - 86_400}:1:1`, NOW, null).t).toBe(NOW - 86_400);
  });

  it('F10: with asOf, t must equal asOf', () => {
    const asOf = 1_700_000_000;
    expect(parseAlgoCursor(`${asOf}:1:1`, NOW, asOf).t).toBe(asOf);
    expect(() => parseAlgoCursor(`${asOf + 1}:1:1`, NOW, asOf)).toThrow(BadRequestException);
    expect(() => parseAlgoCursor(`${NOW}:1:1`, NOW, asOf)).toThrow(BadRequestException);
  });

  it('with asOf, the 24 h rule does not apply', () => {
    const asOf = 1_000_000;
    expect(parseAlgoCursor(`${asOf}:1:1`, NOW, asOf).t).toBe(asOf);
  });

  it.each(['2', '10', '', 'abc', `${NOW}:1`, `${NOW}:1:2:3`, `${NOW}:x:1`, `${NOW}:1:y`, `${NOW}:1.5:1`, `${NOW}:1:-1`, `-5:1:1`, `${NOW}::1`, ` ${NOW}:1:1`])(
    'rejects the malformed cursor %p with 400',
    (raw) => {
      expect(() => parseAlgoCursor(raw, NOW, null)).toThrow(BadRequestException);
    },
  );
});

describe('makeAlgoCursor (TC4)', () => {
  it('writes t:score:id and parses back', () => {
    const c = makeAlgoCursor(NOW, { score: -12, id: 99 });
    expect(c).toBe(`${NOW}:-12:99`);
    expect(parseAlgoCursor(c, NOW, null)).toEqual({ t: NOW, after: { score: -12, id: 99 } });
  });
});

describe('pageAfter (TC4)', () => {
  const items = [
    { id: 9, score: 50 },
    { id: 8, score: 50 },
    { id: 7, score: 50 },
    { id: 20, score: 40 },
    { id: 5, score: 10 },
  ];

  it('with no cursor, gives the first `limit` items and hasMore', () => {
    const p = pageAfter(items, null, 2);
    expect(p.items.map((x) => x.id)).toEqual([9, 8]);
    expect(p.hasMore).toBe(true);
  });

  it('breaks ties on score by id desc', () => {
    const p = pageAfter(items, { score: 50, id: 8 }, 2);
    expect(p.items.map((x) => x.id)).toEqual([7, 20]);
    expect(p.hasMore).toBe(true);
  });

  it('the last page has hasMore false', () => {
    const p = pageAfter(items, { score: 40, id: 20 }, 2);
    expect(p.items.map((x) => x.id)).toEqual([5]);
    expect(p.hasMore).toBe(false);
  });

  it('exactly `limit` items left is not hasMore', () => {
    const p = pageAfter(items, { score: 50, id: 7 }, 2);
    expect(p.items.map((x) => x.id)).toEqual([20, 5]);
    expect(p.hasMore).toBe(false);
  });

  it('an `after` past the end gives an empty page', () => {
    const p = pageAfter(items, { score: 10, id: 5 }, 2);
    expect(p).toEqual({ items: [], hasMore: false });
    expect(pageAfter(items, { score: -1, id: 0 }, 2)).toEqual({ items: [], hasMore: false });
  });

  it('an `after` whose post was removed still continues at the right place', () => {
    // post 8 is gone; the cursor of page 1 was (50, 8)
    const without8 = items.filter((x) => x.id !== 8);
    const p = pageAfter(without8, { score: 50, id: 8 }, 10);
    expect(p.items.map((x) => x.id)).toEqual([7, 20, 5]);
  });

  it('an empty list gives an empty page', () => {
    expect(pageAfter([], null, 10)).toEqual({ items: [], hasMore: false });
  });
});
