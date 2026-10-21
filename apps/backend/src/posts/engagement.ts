/**
 * The engagement part of every post query: counts and "did I like, repost or save it" flags.
 * Posts, profile tabs, search and hashtag pages all spread this into their `include`,
 * so the counts mean the same everywhere (and the Explore score reads the same numbers).
 *
 * Rules (findings T1, T2):
 * - Reposts: only live ones. Un-repost and delete only set `deletedAt`.
 *   Quote reposts count too, they are posts with `rePostId` and some text.
 * - Comments: all non-deleted Comment rows of the post, replies included.
 * - Likes have no `deletedAt`: an unlike deletes the row.
 */
export function engagementSelect(userId?: string) {
  return {
    _count: {
      select: {
        likes: true,
        rePosts: { where: { deletedAt: null } },
        comments: { where: { deletedAt: null } },
      },
    },
    likes: userId ? { where: { userId }, select: { id: true } } : (false as const),
    rePosts: userId ? { where: { userId, deletedAt: null }, select: { id: true } } : (false as const),
    saves: userId ? { where: { userId }, select: { id: true } } : (false as const),
  };
}
