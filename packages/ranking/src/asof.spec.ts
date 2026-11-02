import { ageHours, visibleAt } from './asof';
import type { AsOf } from './types';

describe('visibleAt (the AsOf rule of blueprint 2.6)', () => {
  const withId: AsOf = { t: 1000, beforeEventId: 50 };
  const noId: AsOf = { t: 1000 };

  it('an event before asOf.t is visible, whatever its id', () => {
    expect(visibleAt({ id: 999, t: 999 }, withId)).toBe(true);
    expect(visibleAt({ id: 999, t: 999 }, noId)).toBe(true);
    expect(visibleAt({ id: 0, t: 0 }, noId)).toBe(true);
  });

  it('an event at asOf.t is visible only with an id smaller than beforeEventId', () => {
    expect(visibleAt({ id: 49, t: 1000 }, withId)).toBe(true);
    expect(visibleAt({ id: 0, t: 1000 }, withId)).toBe(true);
    expect(visibleAt({ id: 50, t: 1000 }, withId)).toBe(false);
    expect(visibleAt({ id: 51, t: 1000 }, withId)).toBe(false);
  });

  it('an event at asOf.t is not visible when there is no beforeEventId', () => {
    expect(visibleAt({ id: 0, t: 1000 }, noId)).toBe(false);
    expect(visibleAt({ id: -5, t: 1000 }, noId)).toBe(false);
  });

  it('an event after asOf.t is never visible', () => {
    expect(visibleAt({ id: 0, t: 1001 }, withId)).toBe(false);
    expect(visibleAt({ id: 0, t: 1001 }, noId)).toBe(false);
    expect(visibleAt({ id: 1, t: 5000 }, { t: 1000, beforeEventId: 1_000_000 })).toBe(false);
  });
});

describe('ageHours', () => {
  it('is (asOf.t - createdAt) / 3600', () => {
    expect(ageHours(0, { t: 3600 })).toBe(1);
    expect(ageHours(1800, { t: 3600 })).toBe(0.5);
    expect(ageHours(3600, { t: 3600 })).toBe(0);
    expect(ageHours(100, { t: 100 + 7200, beforeEventId: 3 })).toBe(2);
  });
});
