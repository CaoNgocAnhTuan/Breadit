import type { AsOf, Sec } from './types';

/**
 * The AsOf rule (blueprint 2.6): an event is visible iff e.t < asOf.t,
 * or e.t === asOf.t and e.id < asOf.beforeEventId. With no beforeEventId, only e.t < asOf.t.
 */
export function visibleAt(e: { id: number; t: Sec }, asOf: AsOf): boolean {
  if (e.t < asOf.t) return true;
  return e.t === asOf.t && asOf.beforeEventId !== undefined && e.id < asOf.beforeEventId;
}

/** Post age in hours at asOf. Time is an argument; the package never reads a clock. */
export function ageHours(createdAt: Sec, asOf: AsOf): number {
  return (asOf.t - createdAt) / 3600;
}
