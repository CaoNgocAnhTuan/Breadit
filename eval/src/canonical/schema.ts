// The six canonical tables of blueprint section 2.2: columns, sort keys, columns that may be empty.

export const TABLES = ["users", "follows", "communities", "memberships", "posts", "interactions"] as const;
export type TableName = (typeof TABLES)[number];

export const INTERACTION_TYPES = ["like", "comment", "repost"] as const;
export type InteractionType = (typeof INTERACTION_TYPES)[number];

export interface TableSchema {
  readonly file: string;
  readonly columns: readonly string[];
  readonly sortKeys: readonly string[];
  /** Columns that may be empty (written as nothing, read as null). */
  readonly nullable: readonly string[];
  /** Columns that hold text from a fixed list, not an integer. */
  readonly text: readonly string[];
}

export const SCHEMAS: Readonly<Record<TableName, TableSchema>> = {
  users: {
    file: "users.csv",
    columns: ["user_id", "joined_at"],
    sortKeys: ["user_id"],
    nullable: [],
    text: [],
  },
  follows: {
    file: "follows.csv",
    columns: ["follower_id", "followee_id", "created_at"],
    sortKeys: ["follower_id", "followee_id"],
    nullable: [],
    text: [],
  },
  communities: {
    file: "communities.csv",
    columns: ["community_id", "created_at"],
    sortKeys: ["community_id"],
    nullable: [],
    text: [],
  },
  memberships: {
    file: "memberships.csv",
    columns: ["user_id", "community_id", "joined_at"],
    sortKeys: ["user_id", "community_id"],
    nullable: [],
    text: [],
  },
  posts: {
    file: "posts.csv",
    columns: ["post_id", "author_id", "community_id", "created_at"],
    sortKeys: ["post_id"],
    nullable: ["community_id"],
    text: [],
  },
  interactions: {
    file: "interactions.csv",
    columns: ["event_id", "user_id", "post_id", "type", "created_at"],
    sortKeys: ["created_at", "event_id"],
    nullable: [],
    text: ["type"],
  },
};

export function isTableName(name: string): name is TableName {
  return (TABLES as readonly string[]).includes(name);
}
