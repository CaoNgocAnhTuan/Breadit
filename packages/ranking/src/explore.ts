// The Explore score of production, moved here unchanged from apps/backend/src/posts/posts.service.ts.
// It is BL2 of the evaluation, so the thesis baseline is the production code (super-plan P5).
export function computeExploreScoreFixed(input: { likes: number; comments: number; reposts: number; ageHours: number }): number {
  // score = likes*1 + comments*2 + reposts*3 - ageHours*0.25
  const score = input.likes + input.comments * 2 + input.reposts * 3 - input.ageHours * 0.25;
  return Math.floor(score * 100);
}
