/** Same sizes as the `VarChar` columns in `prisma/schema.prisma` (Post.desc, Comment.body). */
export const POST_DESC_MAX = 255;
export const COMMENT_BODY_MAX = 1000;

/** Length in characters as Postgres counts them: an emoji is 1, not 2 (as `.length` says). */
export function codePointLength(text: string): number {
  let n = 0;
  for (const _ of text) n++;
  return n;
}

export function isTooLong(text: string | null | undefined, max: number): boolean {
  return !!text && codePointLength(text) > max;
}
