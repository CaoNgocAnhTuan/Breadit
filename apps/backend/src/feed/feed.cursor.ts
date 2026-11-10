import { BadRequestException } from '@nestjs/common';

// The cursor of an `algo` feed (design: Approach, "Paging pins the time"). It holds the time t the feed was ranked at
// and the (score, id) of the last item, so the next page is ranked at the same t and starts after that item.

const DAY_SEC = 86400;
const CURSOR = /^(\d+):(-?\d+):(\d+)$/;

export interface AlgoCursor {
  /** Unix seconds: the time the pool is ranked at. */
  t: number;
  /** The last item of the previous page. `null` on the first page. */
  after: { score: number; id: number } | null;
}

/**
 * "1" is the first page: t is `asOfSec`, or `nowSec` when there is no `asOf`.
 * Any other cursor is `t:score:id` (three integers, the score may be negative). Without `asOf`, t must be within the
 * last 24 hours and not in the future. With `asOf`, t must equal it. Everything else is 400 (F10).
 */
export function parseAlgoCursor(raw: string, nowSec: number, asOfSec: number | null): AlgoCursor {
  if (raw === '1') return { t: asOfSec ?? nowSec, after: null };

  const m = CURSOR.exec(raw);
  if (!m) throw new BadRequestException('Invalid cursor');
  const t = Number(m[1]);
  const score = Number(m[2]);
  const id = Number(m[3]);
  if (![t, score, id].every(Number.isSafeInteger)) throw new BadRequestException('Invalid cursor');

  if (asOfSec !== null) {
    if (t !== asOfSec) throw new BadRequestException('Cursor does not match asOf');
  } else {
    if (t > nowSec) throw new BadRequestException('Invalid cursor');
    if (t < nowSec - DAY_SEC) throw new BadRequestException('Cursor expired: start again from the first page');
  }
  return { t, after: { score, id } };
}

export function makeAlgoCursor(t: number, last: { score: number; id: number }): string {
  return `${t}:${last.score}:${last.id}`;
}

/**
 * The items strictly after `after` in the order (score desc, id desc), the first `limit` of them, and whether more
 * follow. The input is the ranked list, which is already in that order.
 */
export function pageAfter<T extends { score: number; id: number }>(
  items: readonly T[],
  after: { score: number; id: number } | null,
  limit: number,
): { items: T[]; hasMore: boolean } {
  const rest =
    after === null
      ? items
      : items.filter((x) => x.score < after.score || (x.score === after.score && x.id < after.id));
  return { items: rest.slice(0, limit), hasMore: rest.length > limit };
}
