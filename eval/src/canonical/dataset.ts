import { readTable } from "./csv.ts";
import { readManifest } from "./manifest.ts";
import type { Manifest } from "./manifest.ts";
import type { InteractionType } from "./schema.ts";

export interface User { userId: number; joinedAt: number }
export interface Follow { followerId: number; followeeId: number; createdAt: number }
export interface Community { communityId: number; createdAt: number }
export interface Membership { userId: number; communityId: number; joinedAt: number }
export interface Post { postId: number; authorId: number; communityId: number | null; createdAt: number }
export interface Interaction { eventId: number; userId: number; postId: number; type: InteractionType; createdAt: number }

export interface Dataset {
  manifest: Manifest;
  users: User[];
  follows: Follow[];
  communities: Community[];
  memberships: Membership[];
  posts: Post[];
  interactions: Interaction[];
}

// Reads a dataset folder with the strict readers. The checks read only this, never the generator's memory.
export function loadDataset(dir: string): Dataset {
  const n = (v: unknown): number => v as number;
  return {
    manifest: readManifest(dir),
    users: readTable(dir, "users").map((r) => ({ userId: n(r.user_id), joinedAt: n(r.joined_at) })),
    follows: readTable(dir, "follows").map((r) => ({
      followerId: n(r.follower_id),
      followeeId: n(r.followee_id),
      createdAt: n(r.created_at),
    })),
    communities: readTable(dir, "communities").map((r) => ({ communityId: n(r.community_id), createdAt: n(r.created_at) })),
    memberships: readTable(dir, "memberships").map((r) => ({
      userId: n(r.user_id),
      communityId: n(r.community_id),
      joinedAt: n(r.joined_at),
    })),
    posts: readTable(dir, "posts").map((r) => ({
      postId: n(r.post_id),
      authorId: n(r.author_id),
      communityId: r.community_id === null ? null : n(r.community_id),
      createdAt: n(r.created_at),
    })),
    interactions: readTable(dir, "interactions").map((r) => ({
      eventId: n(r.event_id),
      userId: n(r.user_id),
      postId: n(r.post_id),
      type: r.type as InteractionType,
      createdAt: n(r.created_at),
    })),
  };
}
