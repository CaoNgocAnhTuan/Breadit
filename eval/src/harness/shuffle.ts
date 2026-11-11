import type { Interaction } from "../canonical/dataset.ts";
import { rng } from "../rng.ts";

// The timestamp shuffle of E5 (design "Shuffle"). Inside each post, the users who engaged with it are shuffled across the
// post's engagement slots. A slot is one (created_at, event_id, type). So a post keeps the same engagers, the same engagement
// curve and the same types in the same slots (BL2 reads only these), and "a followee engaged before me" loses its time order.
// The set of (created_at, event_id) pairs does not change, so T by the rule of blueprint 3.1 does not change either.

/**
 * Returns new rows, sorted by (createdAt, eventId). Posts are walked in id order. Inside a post, the slots are its rows sorted
 * by (createdAt, eventId), and the users are put back in a Fisher-Yates order from one rng(masterSeed, "shuffle") stream for
 * the whole dataset. The input is not changed.
 */
export function shuffleWithinPosts(rows: readonly Interaction[], masterSeed: number): Interaction[] {
  const byPost = new Map<number, Interaction[]>();
  for (const r of rows) {
    const list = byPost.get(r.postId);
    if (list) list.push(r);
    else byPost.set(r.postId, [r]);
  }
  const gen = rng(masterSeed, "shuffle");
  const out: Interaction[] = [];
  for (const postId of [...byPost.keys()].sort((a, b) => a - b)) {
    const slots = (byPost.get(postId) as Interaction[]).sort((a, b) => a.createdAt - b.createdAt || a.eventId - b.eventId);
    const users = slots.map((s) => s.userId);
    for (let i = users.length - 1; i > 0; i--) {
      const j = gen.int(i + 1);
      const tmp = users[i] as number;
      users[i] = users[j] as number;
      users[j] = tmp;
    }
    slots.forEach((s, k) => out.push({ ...s, userId: users[k] as number }));
  }
  return out.sort((a, b) => a.createdAt - b.createdAt || a.eventId - b.eventId);
}
