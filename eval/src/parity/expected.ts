import { createHash } from "node:crypto";
import type { MethodId } from "@breadit/ranking";
import { rankAt } from "../harness/run.ts";
import type { Prepared } from "../harness/run.ts";
import type { ParityPair } from "./sample.ts";

// The harness order of each pair for each `algo` of the live feed (design "Parity sample (eval)", "Expected orders").

/** The method each `algo` runs, in the order of the files. The backend has the same map (ALGO_METHOD), and the parity test checks it. */
export const PARITY_ALGOS: ReadonlyArray<{ algo: string; method: MethodId }> = [
  { algo: "chrono", method: "BL0" },
  { algo: "engagement", method: "BL2" },
  { algo: "social", method: "H" },
];

export interface ParityParams {
  alpha: number;
  beta: number;
  m: number;
}

export interface ExpectedRow {
  pair: number;
  algo: string;
  method: MethodId;
  poolSize: number;
  orderSha256: string;
  /** The first 20 post ids. */
  top20: number[];
  /** The whole order, for the git-ignored orders.csv. */
  order: number[];
}

/** SHA-256 of the post ids as decimals joined by "\n", with no final newline. */
export function orderSha256(ids: readonly number[]): string {
  return createHash("sha256").update(ids.join("\n"), "utf8").digest("hex");
}

/** The params a method needs. Only H takes the three values. */
function variantParams(method: MethodId, p: ParityParams): Record<string, number> {
  return method === "H" ? { alpha: p.alpha, beta: p.beta, m: p.m } : {};
}

/** For each pair and `algo`, the whole pool in rank order by `rankAt`, the same call as the harness and `rank`. Rows are sorted by (pair, algo). */
export function expectedOrders(prep: Prepared, pairs: readonly ParityPair[], params: ParityParams): ExpectedRow[] {
  const rows: ExpectedRow[] = [];
  for (const p of pairs) {
    for (const { algo, method } of PARITY_ALGOS) {
      const order = rankAt(prep, p.user, { t: p.asOf }, { label: method, method, params: variantParams(method, params) }, "normal");
      rows.push({ pair: p.pair, algo, method, poolSize: order.length, orderSha256: orderSha256(order), top20: order.slice(0, 20), order });
    }
  }
  return rows;
}
