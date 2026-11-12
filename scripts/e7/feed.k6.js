/**
 * E7 (task p7-cost-benchmark): the latency of page 1 of one `algo` feed. One run of this script is one run of the benchmark.
 *
 * Do not call it by hand: `npm run bench:e7` (scripts/e7/run-e7.mjs) starts the backend and sets the env variables below.
 *   ALGO      chrono, engagement or social
 *   PAIRS     path of .docs/results/p6-parity/pairs.csv: the 100 (user, asOf) pairs of the parity sample
 *   SESSIONS  path of sessions.json from the prepare step: app user id to the session cookie
 *   SUMMARY   path of the JSON file this run writes
 *   BASE_URL  default http://127.0.0.1:4000
 *
 * Load profile (a frozen value, super-plan section 7): one virtual user, 100 iterations, no sleep. Iteration i asks page 1
 * (`GET /api/posts?algo=<ALGO>&asOf=<as_of_unix of pair i>`) as the user of pair i, in the order of pairs.csv. There is no random part.
 * The backend runs with the page cache off, so every request ranks the pool.
 */
import http from 'k6/http';
import { check } from 'k6';
import exec from 'k6/execution';

const BASE_URL = __ENV.BASE_URL || 'http://127.0.0.1:4000';
const ALGO = __ENV.ALGO;
if (ALGO !== 'chrono' && ALGO !== 'engagement' && ALGO !== 'social') {
  throw new Error('ALGO must be chrono, engagement or social, got "' + ALGO + '"');
}
if (!__ENV.PAIRS || !__ENV.SESSIONS || !__ENV.SUMMARY) throw new Error('PAIRS, SESSIONS and SUMMARY must be set (use npm run bench:e7)');

// pairs.csv: pair,user_id,as_of,as_of_unix,bucket,n_history,n_followees,n_communities,pool_size
const pairs = open(__ENV.PAIRS)
  .split('\n')
  .slice(1)
  .filter((l) => l !== '')
  .map((l) => {
    const c = l.split(',');
    return { pair: c[0], userId: 'u' + c[1].padStart(10, '0'), asOfUnix: c[3] };
  });
const sessions = JSON.parse(open(__ENV.SESSIONS));

export const options = {
  scenarios: {
    feed: { executor: 'shared-iterations', vus: 1, iterations: pairs.length, maxDuration: '10m' },
  },
  discardResponseBodies: true,
  summaryTrendStats: ['min', 'med', 'p(95)', 'max'],
};

export default function () {
  const p = pairs[exec.scenario.iterationInTest];
  const cookie = sessions[p.userId];
  if (cookie === undefined) throw new Error('no session for ' + p.userId);
  const res = http.get(BASE_URL + '/api/posts?algo=' + ALGO + '&asOf=' + p.asOfUnix, {
    headers: { Cookie: cookie },
    tags: { name: 'feed ' + ALGO },
  });
  const ok = check(res, { 'status is 200': (r) => r.status === 200 });
  // The runner reads these lines to name the status codes of a failed run.
  if (!ok) console.error('E7_FAIL status=' + res.status + ' pair=' + p.pair + ' algo=' + ALGO);
}

export function handleSummary(data) {
  const d = data.metrics.http_req_duration.values;
  const out = {
    algo: ALGO,
    requests: data.metrics.http_reqs.values.count,
    failed: data.metrics.http_req_failed.values.passes,
    min_ms: d.min,
    median_ms: d.med,
    p95_ms: d['p(95)'],
    max_ms: d.max,
  };
  return { [__ENV.SUMMARY]: JSON.stringify(out, null, 2) + '\n' };
}
