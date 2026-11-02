import { createHash } from "node:crypto";

// Stage names are fixed by blueprint section 2.4. A new stage gets a new name. Names are never reused.
export const STAGE_NAMES = [
  "users",
  "follows",
  "communities",
  "posts",
  "interactions",
  "bootstrap",
  "permutation",
  "parity",
  "shuffle",
] as const;

export type StageName = (typeof STAGE_NAMES)[number];

export interface Rng {
  /** Next uint32. */
  next(): number;
  /** Next float in [0, 1). */
  float(): number;
  /** Integer in [0, n), no modulo bias. n must be an integer in [1, 2^32]. */
  int(n: number): number;
}

const TWO_32 = 4294967296;

function sfc32(a0: number, b0: number, c0: number, d0: number): () => number {
  let a = a0 | 0;
  let b = b0 | 0;
  let c = c0 | 0;
  let d = d0 | 0;
  return () => {
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return t >>> 0;
  };
}

// sfc32 seeded from sha256("<masterSeed>:<stage>"): the first 16 bytes are four big-endian uint32 (a, b, c, counter).
// The first 12 outputs are dropped. One stream per stage (super-plan section 2, blueprint section 2.4).
export function rng(masterSeed: number, stage: StageName): Rng {
  if (!(STAGE_NAMES as readonly string[]).includes(stage)) {
    throw new Error(`unknown rng stage "${String(stage)}"; allowed: ${STAGE_NAMES.join(", ")}`);
  }
  const digest = createHash("sha256").update(`${masterSeed}:${stage}`, "utf8").digest();
  const gen = sfc32(digest.readUInt32BE(0), digest.readUInt32BE(4), digest.readUInt32BE(8), digest.readUInt32BE(12));
  for (let i = 0; i < 12; i++) gen();
  return {
    next: gen,
    float: () => gen() / TWO_32,
    int(n: number): number {
      if (!Number.isInteger(n) || n < 1 || n > TWO_32) {
        throw new Error(`int(n) needs an integer in [1, 2^32], got ${n}`);
      }
      const limit = TWO_32 - (TWO_32 % n);
      for (;;) {
        const x = gen();
        if (x < limit) return x % n;
      }
    },
  };
}
