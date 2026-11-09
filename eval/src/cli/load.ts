import { parseArgs } from "node:util";
import { loadDataset } from "../canonical/dataset.ts";
import { readManifest } from "../canonical/manifest.ts";
import { checkNode } from "../frozen.ts";
import { datasetDir } from "../generator/generate.ts";
import { load, migrate } from "../loader/db.ts";
import { toAppRows } from "../loader/map.ts";
import { DEFAULT_BASE_URL, DEFAULT_SCHEMA, schemaOf, targetUrl } from "../loader/target.ts";
import { lastEventTime, rebaseShift, toDate } from "../loader/time.ts";

// Usage: npm run load -w @breadit/eval -- <datasetId> [--schema eval_x] [--rebase-to YYYY-MM-DDTHH:MM:SSZ]
// Loads eval/data/<datasetId>/ (a synthetic dataset) into the Postgres schema eval_load (or the eval_ schema given).
// The base URL is the shell's DATABASE_URL, else the Docker default. Its own schema parameter is always replaced.
// --rebase-to adds one constant shift to every time (demo only; no experiment uses it). Needs: docker compose up db redis -d.
const USAGE = "usage: npm run load -w @breadit/eval -- <datasetId> [--schema eval_x] [--rebase-to YYYY-MM-DDTHH:MM:SSZ]";

function iso(d: Date): string {
  return d.toISOString().replace(".000Z", "Z");
}

async function main(): Promise<void> {
  checkNode();
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: { schema: { type: "string" }, "rebase-to": { type: "string" } },
    allowPositionals: true,
  });
  if (positionals.length !== 1) throw new Error(USAGE);
  const id = positionals[0] as string;
  const schema = values.schema ?? DEFAULT_SCHEMA;
  const url = targetUrl(process.env.DATABASE_URL ?? DEFAULT_BASE_URL, schema);
  const started = performance.now(); // harness-allow: run time of the command, printed only (Class R)

  const dir = datasetDir(new URL("../../data", import.meta.url).pathname, id);
  const kind = readManifest(dir).source.kind; // read first: a big dataset (digg2009) is refused before its files are read
  if (kind !== "synthetic") throw new Error(`dataset ${id} has source.kind "${String(kind)}": only synthetic datasets are loaded`);
  const d = loadDataset(dir);
  const epoch = d.manifest.epoch.seconds;
  const rebase = values["rebase-to"];
  const shift = rebase === undefined ? 0 : rebaseShift(d, epoch, rebase);
  const rows = toAppRows(d, epoch, shift);

  migrate(url);
  const c = await load(url, rows);
  const seconds = (performance.now() - started) / 1000; // harness-allow: run time of the command, printed only (Class R)

  process.stdout.write(
    [
      `${id} loaded into schema ${schemaOf(url)}`,
      `User ${c.users}`,
      `Follow ${c.follows}`,
      `Community ${c.communities}`,
      `CommunityMember ${c.members}`,
      `Post ${c.posts + c.reposts} (${c.posts} posts, ${c.reposts} reposts)`,
      `Like ${c.likes}`,
      `Comment ${c.comments}`,
      `shift ${shift} s`,
      `latest time ${iso(toDate(epoch, lastEventTime(d), shift))}`,
      `run time ${seconds.toFixed(1)} s`,
      "",
    ].join("\n"),
  );
}

main().catch((e: unknown) => {
  process.stderr.write(`error: ${(e as Error).message}\n`);
  process.exitCode = 1;
});
