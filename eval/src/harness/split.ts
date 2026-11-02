import { bucketOf, cutTime, historyCount, testItems } from "../checks/buckets.ts";
import type { Event } from "../checks/buckets.ts";

// The split of super-plan section 5. The rule for T and for the test item exists once, in checks/buckets.ts
// (blueprint sections 3.1 and 3.2). This file re-exports it and adds the validation item.
export { bucketOf, cutTime, historyCount, testItems };
export type { Event };

export type SplitName = "validation" | "test";

/** The user's last positive (by (t, id)) with t <= T. An event at exactly T is validation. */
export function validationItems(pos: readonly Event[], cut: number): Map<number, Event> {
  const best = new Map<number, Event>();
  for (const ev of pos) {
    if (ev.t <= cut) {
      const cur = best.get(ev.user);
      if (!cur || ev.t > cur.t || (ev.t === cur.t && ev.id > cur.id)) best.set(ev.user, ev);
    }
  }
  return best;
}

/** One item per user for the named split. */
export function splitItems(pos: readonly Event[], cut: number, split: SplitName): Map<number, Event> {
  if (split === "validation") return validationItems(pos, cut);
  if (split === "test") return testItems(pos, cut);
  throw new Error(`unknown split "${String(split)}"; use "validation" or "test"`);
}
