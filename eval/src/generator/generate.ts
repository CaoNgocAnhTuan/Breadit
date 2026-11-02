import { mkdirSync, rmSync } from "node:fs";
import { relative, resolve, sep } from "node:path";
import { writeTable } from "../canonical/csv.ts";
import type { FileEntry } from "../canonical/csv.ts";
import { writeManifest } from "../canonical/manifest.ts";
import type { Manifest } from "../canonical/manifest.ts";
import { SCHEMAS } from "../canonical/schema.ts";
import { loadFrozen } from "../frozen.ts";
import { rng } from "../rng.ts";
import { genCommunities } from "./communities.ts";
import { configSha256, loadConfig, makeParams } from "./config.ts";
import type { SizeId, WorldId } from "./config.ts";
import { genFollows } from "./follows.ts";
import { genInteractions } from "./interactions.ts";
import { genPosts } from "./posts.ts";
import { genUsers } from "./users.ts";

export type DatasetId = `syn-${WorldId}-${SizeId}`;

const IDS: readonly DatasetId[] = [
  "syn-W0-S",
  "syn-W1-S",
  "syn-W2M-S",
  "syn-W0-M",
  "syn-W1-M",
  "syn-W2L-M",
  "syn-W2M-M",
  "syn-W2H-M",
];

/** The eight datasets that blueprint section 4 uses, in a fixed order. */
export function datasetIds(): DatasetId[] {
  return [...IDS];
}

export function isDatasetId(id: string): id is DatasetId {
  return (IDS as readonly string[]).includes(id);
}

export function parseDatasetId(id: string): { world: WorldId; size: SizeId } {
  if (!isDatasetId(id)) throw new Error(`unknown dataset id "${id}"`);
  const [, world, size] = id.split("-");
  return { world: world as WorldId, size: size as SizeId };
}

/** `<outDir>/<id>`. Throws if the result is not inside outDir. */
export function datasetDir(outDir: string, id: string): string {
  const root = resolve(outDir);
  const dir = resolve(root, id);
  const rel = relative(root, dir);
  if (rel === "" || rel.startsWith("..") || rel.split(sep).length !== 1) {
    throw new Error(`dataset path "${dir}" is outside the out dir "${root}"`);
  }
  return dir;
}

/**
 * Runs the five stages for one dataset and writes six CSV files and manifest.json into <outDir>/<id>.
 * The streams are the same for every dataset, so the worlds are a controlled comparison.
 * The folder is deleted first, so no old file stays.
 */
export function generateDataset(id: string, outDir: string): Manifest {
  const { world, size } = parseDatasetId(id);
  const frozen = loadFrozen();
  const config = loadConfig();
  const p = makeParams(config, frozen, world, size);
  const seed = frozen.masterSeed;

  const users = genUsers(rng(seed, "users"), p);
  const follows = genFollows(rng(seed, "follows"), p, users);
  const { communities, memberships } = genCommunities(rng(seed, "communities"), p, users);
  const posts = genPosts(rng(seed, "posts"), p, users, memberships);
  const { interactions, skipped } = genInteractions(rng(seed, "interactions"), p, users, follows, memberships, posts);

  const dir = datasetDir(outDir, id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  const files: Record<string, FileEntry> = {};
  files[SCHEMAS.users.file] = writeTable(dir, "users", users.map((u) => ({ user_id: u.userId, joined_at: u.joinedAt })));
  files[SCHEMAS.follows.file] = writeTable(
    dir,
    "follows",
    follows.map((f) => ({ follower_id: f.followerId, followee_id: f.followeeId, created_at: f.createdAt })),
  );
  files[SCHEMAS.communities.file] = writeTable(
    dir,
    "communities",
    communities.map((c) => ({ community_id: c.communityId, created_at: c.createdAt })),
  );
  files[SCHEMAS.memberships.file] = writeTable(
    dir,
    "memberships",
    memberships.map((m) => ({ user_id: m.userId, community_id: m.communityId, joined_at: m.joinedAt })),
  );
  files[SCHEMAS.posts.file] = writeTable(
    dir,
    "posts",
    posts.map((x) => ({ post_id: x.postId, author_id: x.authorId, community_id: x.communityId, created_at: x.createdAt })),
  );
  files[SCHEMAS.interactions.file] = writeTable(
    dir,
    "interactions",
    interactions.map((e) => ({
      event_id: e.eventId,
      user_id: e.userId,
      post_id: e.postId,
      type: e.type,
      created_at: e.createdAt,
    })),
  );

  const manifest: Manifest = {
    schemaVersion: 1,
    datasetId: id,
    source: {
      kind: "synthetic",
      config: "eval/config/synthetic-v1.json",
      configSha256: configSha256(),
      world,
      size,
      skippedActions: skipped,
    },
    masterSeed: seed,
    epoch: { iso: frozen.baseEpoch.iso, seconds: frozen.baseEpoch.seconds },
    node: process.version,
    files,
  };
  writeManifest(dir, manifest);
  return manifest;
}
