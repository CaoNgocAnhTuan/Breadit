import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadDataset } from "../canonical/dataset.ts";
import { writeTable } from "../canonical/csv.ts";
import type { FileEntry } from "../canonical/csv.ts";
import { SCHEMAS, TABLES } from "../canonical/schema.ts";
import { checkNode } from "../frozen.ts";
import { datasetDir } from "../generator/generate.ts";
import { readBack } from "../loader/db.ts";
import { detectShift, fromAppRows } from "../loader/map.ts";
import { DEFAULT_BASE_URL, DEFAULT_SCHEMA, targetUrl } from "../loader/target.ts";
import { lastEventTime, toDate } from "../loader/time.ts";

// Usage: npm run load:check -w @breadit/eval -- <datasetId> [--schema eval_x] [--out <dir>]
// Reads the six canonical tables back out of the Postgres schema, writes them as canonical CSV files and compares their
// SHA-256 with eval/data/<datasetId>/manifest.json. The shift (a --rebase-to load) is found from the data and removed first.
// Meant right after a load: rows the app added since then show up as DIFF. Exit 1 on any DIFF.
// Default out: eval/results/load-check/<datasetId>/ (git-ignored; a relative path is relative to eval/).
const USAGE = "usage: npm run load:check -w @breadit/eval -- <datasetId> [--schema eval_x] [--out <dir>]";

function iso(d: Date): string {
  return d.toISOString().replace(".000Z", "Z");
}

async function main(): Promise<void> {
  checkNode();
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { schema: { type: "string" }, out: { type: "string" } },
    allowPositionals: true,
  });
  if (positionals.length !== 1) throw new Error(USAGE);
  const id = positionals[0] as string;
  const schema = values.schema ?? DEFAULT_SCHEMA;
  const url = targetUrl(process.env.DATABASE_URL ?? DEFAULT_BASE_URL, schema);
  const dataDir = new URL("../../data", import.meta.url).pathname;
  const out = values.out !== undefined ? resolve(values.out) : join(new URL("../../results/load-check", import.meta.url).pathname, id);

  const d = loadDataset(datasetDir(dataDir, id));
  const epoch = d.manifest.epoch.seconds;
  const rows = await readBack(url);
  const shift = detectShift(rows, d, epoch);
  const t = fromAppRows(rows, epoch, shift);

  const written: Record<string, FileEntry> = {
    [SCHEMAS.users.file]: writeTable(out, "users", t.users.map((u) => ({ user_id: u.userId, joined_at: u.joinedAt }))),
    [SCHEMAS.follows.file]: writeTable(out, "follows", t.follows.map((f) => ({ follower_id: f.followerId, followee_id: f.followeeId, created_at: f.createdAt }))),
    [SCHEMAS.communities.file]: writeTable(out, "communities", t.communities.map((c) => ({ community_id: c.communityId, created_at: c.createdAt }))),
    [SCHEMAS.memberships.file]: writeTable(out, "memberships", t.memberships.map((m) => ({ user_id: m.userId, community_id: m.communityId, joined_at: m.joinedAt }))),
    [SCHEMAS.posts.file]: writeTable(
      out,
      "posts",
      t.posts.map((p) => ({ post_id: p.postId, author_id: p.authorId, community_id: p.communityId, created_at: p.createdAt })),
    ),
    [SCHEMAS.interactions.file]: writeTable(
      out,
      "interactions",
      t.interactions.map((e) => ({ event_id: e.eventId, user_id: e.userId, post_id: e.postId, type: e.type, created_at: e.createdAt })),
    ),
  };

  const lines: string[] = [`${id} read back from schema ${schema} into ${out}`];
  let diffs = 0;
  for (const table of TABLES) {
    const file = SCHEMAS[table].file;
    const want = d.manifest.files[file];
    const got = written[file] as FileEntry;
    if (want !== undefined && want.sha256 === got.sha256 && want.rows === got.rows) {
      lines.push(`ok    ${file} ${got.rows} rows sha256 ${got.sha256}`);
    } else {
      diffs++;
      lines.push(`DIFF  ${file} manifest ${want === undefined ? "none" : `${want.rows} rows sha256 ${want.sha256}`}, database ${got.rows} rows sha256 ${got.sha256}`);
    }
  }
  lines.push(`shift ${shift} s`);
  lines.push(`latest time ${iso(toDate(epoch, lastEventTime(t), shift))}`);
  lines.push(diffs === 0 ? `${TABLES.length} of ${TABLES.length} files equal the manifest` : `${diffs} of ${TABLES.length} files differ from the manifest (this check is meant right after a load)`);
  process.stdout.write(lines.join("\n") + "\n");
  process.exitCode = diffs === 0 ? 0 : 1;
}

main().catch((e: unknown) => {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exitCode = 1;
});
