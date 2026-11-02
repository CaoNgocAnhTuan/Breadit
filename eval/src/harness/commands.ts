import { parseArgs } from "node:util";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { MethodId } from "@breadit/ranking";
import { loadDataset } from "../canonical/dataset.ts";
import { sha256Hex } from "../canonical/csv.ts";
import { loadFrozen } from "../frozen.ts";
import { REQUIRED_PARAMS, parseRunConfig, resolveParam } from "./config.ts";
import type { ParamValue, RunConfig, Variant } from "./config.ts";
import { computeCutTime, countItems, defaultDataDir, prepare, rankAt, runConfig } from "./run.ts";
import { positiveEvents } from "./index-data.ts";
import { tuneConfig, writeTuning } from "./tuning.ts";
import { writeResults } from "./write.ts";
import { GROUPS, METHOD_ORDER } from "../metrics.ts";
import type { FileEntry } from "../canonical/csv.ts";

// The two commands (blueprint section 2.9 and design "Runs are configs"). The logic is here so that tests can call it.
// The split comes only from the run config file, never from a flag.

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;

export interface CommandEnv {
  /** The folder with one subfolder per dataset id (default: eval/data). */
  dataDir?: string;
}

function configPath(arg: string): string {
  if (arg.includes("/") || arg.endsWith(".json")) return resolve(arg);
  return join(REPO_ROOT, "eval", "config", "runs", `${arg}.json`);
}

function loadConfigFile(arg: string): { cfg: RunConfig; text: string; runId: string } {
  const path = configPath(arg);
  if (!existsSync(path)) throw new Error(`run config not found: ${path}`);
  const text = readFileSync(path, "utf8");
  return { cfg: parseRunConfig(text), text, runId: basename(path).replace(/\.json$/, "") };
}

function toInt(name: string, v: string | undefined): number {
  if (v === undefined || !/^\d+$/.test(v)) throw new Error(`--${name} needs a non-negative integer, got ${String(v)}`);
  return Number(v);
}

/** `harness <runId|path> [--out <dir>] [--record-t] [--data-dir <dir>]`. Returns the lines to print. */
export function harnessCommand(argv: string[], env: CommandEnv = {}): string[] {
  const { values, positionals } = parseArgs({
    args: argv,
    options: { out: { type: "string" }, "record-t": { type: "boolean" }, "data-dir": { type: "string" } },
    allowPositionals: true,
    strict: true,
  });
  if (positionals.length !== 1) throw new Error("usage: harness <runId|path to a run config> [--out <dir>] [--record-t] [--data-dir <dir>]");
  const { cfg, text, runId } = loadConfigFile(positionals[0] as string);
  const dataDir = values["data-dir"] !== undefined ? resolve(values["data-dir"]) : (env.dataDir ?? defaultDataDir());
  const lines: string[] = [];
  const frozen = loadFrozen();

  if (values["record-t"]) {
    // T by the rule of blueprint section 3.1, next to the recorded one. No ranking and no result files.
    for (const id of cfg.datasets) {
      const data = loadDataset(join(dataDir, id));
      const T = computeCutTime(positiveEvents(data));
      const rec = frozen.cutTimes[id];
      const state = rec === undefined ? "not recorded" : rec === T ? "equal" : "DIFFERENT";
      lines.push(`${id}  T ${T}  recorded ${rec === undefined ? "none" : rec}  ${state}`);
      const counts = countItems(id, data, cfg.split, cfg.pool, { holdT: T });
      lines.push(`  ${cfg.split} items per bucket (users with an item, left out of the pool)`);
      for (const g of GROUPS) {
        const r = counts.leftOut.find((x) => x.bucket === g);
        lines.push(`  ${g.padEnd(5)}  ${String(r?.nTestUsers ?? 0).padStart(7)}  ${String(r?.nLeftOut ?? 0).padStart(7)}`);
      }
    }
    return lines;
  }

  const outDir = values.out !== undefined ? resolve(values.out) : join(REPO_ROOT, ".docs", "results", runId);
  const externalDir = values.out !== undefined ? outDir : join(REPO_ROOT, "eval", "results", runId);
  const hasGrid = Object.values(cfg.params).some((p) => Object.values(p).includes("grid"));
  const extraFiles: Record<string, FileEntry> = {};
  let variants: Record<string, Variant[]> | undefined;
  if (hasGrid) {
    const tuned = tuneConfig(cfg, { dataDir });
    extraFiles["tuning.csv"] = writeTuning(outDir, tuned.rows);
    variants = tuned.variants;
    lines.push(`tuning: ${tuned.rows.length} grid points, ${tuned.rows.filter((r) => r.chosen).length} chosen`);
  }
  const result = runConfig(cfg, { dataDir, ...(variants ? { variants } : {}) });
  const manifest = writeResults(result, {
    runId,
    outDir,
    externalDir,
    configText: text,
    extraFiles,
    ...(values.out !== undefined ? { perUserLimitBytes: Number.POSITIVE_INFINITY } : {}),
  });
  for (const d of result.datasets) {
    const all = d.leftOut.find((r) => r.bucket === "all");
    lines.push(`${d.dataset}  T ${d.T}  ${d.split}  users ${all?.nTestUsers ?? 0}  left out ${all?.nLeftOut ?? 0}  per_user rows ${d.perUser.length}`);
  }
  lines.push(`results: ${outDir}`);
  if (manifest.external) lines.push(`not committed (over the limit): ${manifest.external.join(", ")} in ${externalDir}`);
  lines.push(`manifest sha256 ${sha256Hex(readFileSync(join(outDir, "manifest.json")))}`);
  return lines;
}

function parseParam(s: string): [string, ParamValue] {
  const m = /^([A-Za-z]+)=(.+)$/.exec(s);
  if (!m) throw new Error(`--param needs name=value, got "${s}"`);
  const v = m[2] as string;
  if (v === "frozen") return [m[1] as string, "frozen"];
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--param ${m[1]} needs a number or "frozen", got "${v}"`);
  return [m[1] as string, n];
}

/**
 * `rank --dataset <id> --method <m> --user <u> --asof <t> [--before-event <id>] --top <n> [--param name=value]... [--config <runId|path>]
 * [--pool normal|large]`. Prints post ids in rank order, one per line (blueprint section 2.9).
 */
export function rankCommand(argv: string[], env: CommandEnv = {}): string[] {
  const { values } = parseArgs({
    args: argv,
    options: {
      dataset: { type: "string" },
      method: { type: "string" },
      user: { type: "string" },
      asof: { type: "string" },
      "before-event": { type: "string" },
      top: { type: "string" },
      param: { type: "string", multiple: true },
      config: { type: "string" },
      pool: { type: "string" },
      "data-dir": { type: "string" },
    },
    strict: true,
  });
  for (const k of ["dataset", "method", "user", "asof", "top"] as const) {
    if (values[k] === undefined) throw new Error("rank needs --dataset, --method, --user, --asof and --top");
  }
  const method = values.method as string;
  if (!METHOD_ORDER.includes(method)) throw new Error(`unknown method "${method}"; allowed: ${METHOD_ORDER.join(", ")}`);
  const userArg = values.user as string;
  const user = /^u\d{10}$/.test(userArg) ? Number(userArg.slice(1)) : toInt("user", userArg);
  const asOf = { t: toInt("asof", values.asof), ...(values["before-event"] !== undefined ? { beforeEventId: toInt("before-event", values["before-event"]) } : {}) };
  const top = toInt("top", values.top);
  const pool = values.pool ?? "normal";
  if (pool !== "normal" && pool !== "large") throw new Error(`--pool must be normal or large, got "${pool}"`);

  // Params: from the run config first, then from flags.
  const given: Record<string, ParamValue> = {};
  if (values.config !== undefined) {
    const { cfg } = loadConfigFile(values.config);
    if (!cfg.methods.includes(method)) throw new Error(`method ${method} is not in the run config ${values.config}`);
    Object.assign(given, cfg.params[method] ?? {});
  }
  for (const p of values.param ?? []) {
    const [name, v] = parseParam(p);
    given[name] = v;
  }
  const params: Record<string, number> = {};
  for (const name of REQUIRED_PARAMS[method as MethodId]) {
    if (!(name in given)) throw new Error(`method ${method} needs the param "${name}": give it with --param ${name}=<value> or with --config`);
    params[name] = resolveParam(given[name] as ParamValue);
  }
  const dataDir = values["data-dir"] !== undefined ? resolve(values["data-dir"]) : (env.dataDir ?? defaultDataDir());
  const data = loadDataset(join(dataDir, values.dataset as string));
  if (!data.users.some((u) => u.userId === user)) throw new Error(`user ${user} is not in dataset ${values.dataset}`);
  const prep = prepare(values.dataset as string, data, "fast");
  const ranked = rankAt(prep, user, asOf, { label: method, method: method as MethodId, params }, pool);
  return ranked.slice(0, top).map(String);
}
