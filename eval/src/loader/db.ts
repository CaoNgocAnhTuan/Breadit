import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import type { AppRows } from "./map.ts";
import { schemaOf } from "./target.ts";

// The only file of eval that imports @prisma/client (blueprint section 1). It runs the migrations, empties the schema,
// writes the rows and reads them back. Every URL it takes must come from targetUrl: the schema name that goes into raw SQL
// is read with schemaOf, which refuses everything except an eval_ name.

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const BACKEND_SCHEMA = "apps/backend/prisma/schema.prisma";
const BATCH = 1000;
const TRANSACTION_TIMEOUT_MS = 300_000;
const TRANSACTION_MAX_WAIT_MS = 30_000;
const GENERATE_HINT = "Run `npx prisma generate --schema=apps/backend/prisma/schema.prisma` (npm ci deletes the generated client).";

export interface Counts {
  users: number;
  follows: number;
  communities: number;
  members: number;
  /** Canonical posts: `Post` rows with no `rePostId`. */
  posts: number;
  /** `Post` rows with a `rePostId`. */
  reposts: number;
  likes: number;
  comments: number;
}

function client(url: string): PrismaClient {
  try {
    return new PrismaClient({ datasources: { db: { url } }, log: [] });
  } catch (e) {
    throw new Error(`cannot start the Prisma client: ${(e as Error).message}\n${GENERATE_HINT}`);
  }
}

/** `prisma migrate deploy` on the target schema. On a new schema it creates every table (and the humans_v1 rows of the two data migrations). */
export function migrate(url: string): void {
  schemaOf(url);
  try {
    execFileSync("npx", ["prisma", "migrate", "deploy", `--schema=${BACKEND_SCHEMA}`], {
      cwd: REPO_ROOT,
      env: { ...process.env, DATABASE_URL: url },
      stdio: "pipe",
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(`prisma migrate deploy failed. Is \`docker compose up db redis -d\` running?\n${e.stdout?.toString() ?? ""}\n${e.stderr?.toString() ?? ""}`);
  }
}

async function insertAll<T>(rows: readonly T[], write: (batch: T[]) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < rows.length; i += BATCH) await write(rows.slice(i, i + BATCH));
}

function maxId(...lists: ReadonlyArray<readonly { id: number }[]>): number {
  let max = 0;
  for (const rows of lists) for (const r of rows) if (r.id > max) max = r.id;
  return max;
}

async function empty(tx: Prisma.TransactionClient, schema: string): Promise<void> {
  const tables = await tx.$queryRaw<{ tablename: string }[]>`select tablename from pg_tables where schemaname = ${schema} and tablename <> '_prisma_migrations'`;
  if (tables.length === 0) return;
  const quote = (s: string): string => `"${s.replaceAll('"', '""')}"`;
  const list = tables.map((t) => `${quote(schema)}.${quote(t.tablename)}`).join(", ");
  await tx.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function moveSequence(tx: Prisma.TransactionClient, schema: string, table: string, max: number): Promise<void> {
  if (max < 1) return; // an empty table keeps the sequence that TRUNCATE ... RESTART IDENTITY reset
  await tx.$queryRawUnsafe(`select setval(pg_get_serial_sequence($1::text, 'id'), $2::bigint)`, `"${schema}"."${table}"`, max);
}

/**
 * Empties the target schema and writes the rows, in one transaction (a failure rolls everything back).
 * Insert order follows the foreign keys: User, Community, CommunityMember, Follow, Post, repost Posts, Like, Comment.
 */
export async function load(url: string, rows: AppRows): Promise<Counts> {
  const schema = schemaOf(url);
  const prisma = client(url);
  try {
    return await prisma.$transaction(
      async (tx) => {
        await empty(tx, schema);
        await insertAll(rows.users, (data) => tx.user.createMany({ data }));
        await insertAll(rows.communities, (data) => tx.community.createMany({ data }));
        await insertAll(rows.members, (data) => tx.communityMember.createMany({ data }));
        await insertAll(rows.follows, (data) => tx.follow.createMany({ data }));
        await insertAll(rows.posts, (data) => tx.post.createMany({ data }));
        await insertAll(rows.reposts, (data) => tx.post.createMany({ data }));
        await insertAll(rows.likes, (data) => tx.like.createMany({ data }));
        await insertAll(rows.comments, (data) => tx.comment.createMany({ data }));
        await moveSequence(tx, schema, "Post", maxId(rows.posts, rows.reposts));
        await moveSequence(tx, schema, "Like", maxId(rows.likes));
        await moveSequence(tx, schema, "Comment", maxId(rows.comments));
        await moveSequence(tx, schema, "Follow", maxId(rows.follows));
        await moveSequence(tx, schema, "Community", maxId(rows.communities));
        await moveSequence(tx, schema, "CommunityMember", maxId(rows.members));
        return {
          users: await tx.user.count(),
          follows: await tx.follow.count(),
          communities: await tx.community.count(),
          members: await tx.communityMember.count(),
          posts: await tx.post.count({ where: { rePostId: null } }),
          reposts: await tx.post.count({ where: { rePostId: { not: null } } }),
          likes: await tx.like.count(),
          comments: await tx.comment.count(),
        };
      },
      { timeout: TRANSACTION_TIMEOUT_MS, maxWait: TRANSACTION_MAX_WAIT_MS },
    );
  } finally {
    await prisma.$disconnect();
  }
}

/** Reads the rows of the target schema, every table ordered by id. A `Post` with a `rePostId` goes to `reposts`. */
export async function readBack(url: string): Promise<AppRows> {
  schemaOf(url);
  const prisma = client(url);
  try {
    const orderBy = { id: "asc" } as const;
    const users = await prisma.user.findMany({ orderBy });
    const communities = await prisma.community.findMany({ orderBy });
    const members = await prisma.communityMember.findMany({ orderBy });
    const follows = await prisma.follow.findMany({ orderBy });
    const posts = await prisma.post.findMany({ orderBy });
    const likes = await prisma.like.findMany({ orderBy });
    const comments = await prisma.comment.findMany({ orderBy });
    const post = (p: (typeof posts)[number]): AppRows["posts"][number] => ({
      id: p.id,
      userId: p.userId,
      communityId: p.communityId,
      desc: p.desc,
      rePostId: p.rePostId,
      isApproved: p.isApproved,
      deletedAt: p.deletedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    });
    return {
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        displayName: u.displayName ?? "",
        password: u.password ?? "",
        emailVerified: u.emailVerified ?? u.createdAt,
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      communities: communities.map((c) => ({ id: c.id, name: c.name, slug: c.slug, createdAt: c.createdAt, updatedAt: c.updatedAt })),
      members: members.map((m) => ({ id: m.id, role: "MEMBER" as const, userId: m.userId, communityId: m.communityId, createdAt: m.createdAt })),
      follows: follows.map((f) => ({ id: f.id, notify: f.notify, followerId: f.followerId, followingId: f.followingId, createdAt: f.createdAt })),
      posts: posts.filter((p) => p.rePostId === null).map(post),
      reposts: posts.filter((p) => p.rePostId !== null).map(post),
      likes: likes.map((l) => ({ id: l.id, userId: l.userId, postId: l.postId, createdAt: l.createdAt })),
      comments: comments.map((c) => ({
        id: c.id,
        body: c.body,
        userId: c.userId,
        postId: c.postId,
        deletedAt: c.deletedAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    };
  } finally {
    await prisma.$disconnect();
  }
}
