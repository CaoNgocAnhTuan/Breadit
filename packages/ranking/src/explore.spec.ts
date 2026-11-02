import { computeExploreScoreFixed } from './explore';

// Verbatim copy of the private function that lived in apps/backend/src/posts/posts.service.ts
// before it moved here. It is the reference of the golden test (design F3).
function referenceComputeExploreScoreFixed(input: {
  likes: number;
  comments: number;
  reposts: number;
  ageHours: number;
}): number {
  // score = likes*1 + comments*2 + reposts*3 - ageHours*0.25
  const score = input.likes + input.comments * 2 + input.reposts * 3 - input.ageHours * 0.25;
  return Math.floor(score * 100);
}

type Input = { likes: number; comments: number; reposts: number; ageHours: number };

const TABLE: ReadonlyArray<Input> = [
  // all zero
  { likes: 0, comments: 0, reposts: 0, ageHours: 0 },
  // large counts
  { likes: 1_000_000, comments: 250_000, reposts: 90_000, ageHours: 0 },
  { likes: 123_456, comments: 7_890, reposts: 1_234, ageHours: 168 },
  // fractional ages
  { likes: 3, comments: 1, reposts: 0, ageHours: 0.1 },
  { likes: 3, comments: 1, reposts: 0, ageHours: 1 / 3 },
  { likes: 0, comments: 0, reposts: 0, ageHours: 1.5 },
  { likes: 5, comments: 5, reposts: 5, ageHours: 167.99999 },
  // an age that makes the score negative
  { likes: 0, comments: 0, reposts: 0, ageHours: 100 },
  { likes: 1, comments: 0, reposts: 0, ageHours: 168 },
  { likes: 2, comments: 1, reposts: 0, ageHours: 10_000.37 },
  // a score exactly at a x100 boundary (4 likes at 16 hours gives 0, 1 like at 4 hours gives 0)
  { likes: 4, comments: 0, reposts: 0, ageHours: 16 },
  { likes: 1, comments: 0, reposts: 0, ageHours: 4 },
  { likes: 1, comments: 0, reposts: 0, ageHours: 3.96 },
  { likes: 1, comments: 0, reposts: 0, ageHours: 4.04 },
  { likes: 0, comments: 0, reposts: 0, ageHours: 0.04 },
  { likes: 0, comments: 0, reposts: 0, ageHours: 0.08 },
];

describe('computeExploreScoreFixed (moved from the backend)', () => {
  it('equals the old backend function on a fixed table of inputs', () => {
    for (const input of TABLE) {
      expect(computeExploreScoreFixed(input)).toBe(referenceComputeExploreScoreFixed(input));
    }
  });

  it('equals the old backend function on a grid of small inputs', () => {
    for (let likes = 0; likes <= 4; likes++) {
      for (let comments = 0; comments <= 3; comments++) {
        for (let reposts = 0; reposts <= 3; reposts++) {
          for (const ageHours of [0, 0.5, 1, 2.25, 7.7, 24, 100.01, 167.5]) {
            const input = { likes, comments, reposts, ageHours };
            expect(computeExploreScoreFixed(input)).toBe(referenceComputeExploreScoreFixed(input));
          }
        }
      }
    }
  });

  it('gives hand-computed values: 1 per like, 2 per comment, 3 per repost, minus 0.25 per hour, times 100', () => {
    // 10 + 2*2 + 3*1 - 8*0.25 = 15, times 100
    expect(computeExploreScoreFixed({ likes: 10, comments: 2, reposts: 1, ageHours: 8 })).toBe(1500);
    // -100 * 0.25 = -25, times 100
    expect(computeExploreScoreFixed({ likes: 0, comments: 0, reposts: 0, ageHours: 100 })).toBe(-2500);
    // -1.5 * 0.25 = -0.375, times 100 is -37.5, floor is -38
    expect(computeExploreScoreFixed({ likes: 0, comments: 0, reposts: 0, ageHours: 1.5 })).toBe(-38);
    // exactly zero
    expect(computeExploreScoreFixed({ likes: 4, comments: 0, reposts: 0, ageHours: 16 })).toBe(0);
    expect(computeExploreScoreFixed({ likes: 0, comments: 0, reposts: 0, ageHours: 0 })).toBe(0);
  });

  it('returns an integer', () => {
    for (const input of TABLE) {
      expect(Number.isInteger(computeExploreScoreFixed(input))).toBe(true);
    }
  });
});
