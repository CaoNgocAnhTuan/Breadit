import type { GenParams } from "./config.ts";

// Hidden interests: one main topic plus a spread over all topics.
//   interest(u, z) = (1 - s) [z is the main topic of u] + s / Z
// Only + - * / are used, so the values are exact on every engine.

export function interestMain(p: GenParams): number {
  return 1 - p.interestSpread + p.interestSpread / p.topics;
}

export function interestOther(p: GenParams): number {
  return p.interestSpread / p.topics;
}

/** interest(u, topic) for a user whose main topic is `main`. */
export function interestOf(p: GenParams, main: number, topic: number): number {
  return topic === main ? interestMain(p) : interestOther(p);
}

/** Similarity of two users, from the dot product of their interest vectors, 1 for the same main topic. */
export function userSimilarity(p: GenParams, a: number, b: number): number {
  if (a === b) return 1;
  const m = interestMain(p);
  const o = interestOther(p);
  const z = p.topics;
  const same = m * m + (z - 1) * o * o;
  const diff = 2 * m * o + (z - 2) * o * o;
  return diff / same;
}

/** Affinity of a user for a topic, 1 for the main topic. */
export function topicAffinity(p: GenParams, main: number, topic: number): number {
  return topic === main ? 1 : interestOther(p) / interestMain(p);
}

/** Weight of a candidate: 1 - h + h x similarity. h = 0 is no homophily. */
export function homophilyWeight(p: GenParams, similarity: number): number {
  return 1 - p.homophily + p.homophily * similarity;
}
