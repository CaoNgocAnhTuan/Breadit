/**
 * Breadit Performance Test — k6 Load Testing Script (v2)
 *
 * Run from project root:
 *   k6 run docs/planning/k6_perf_test.js
 *
 * Fixes from v1:
 *   - Use r.json() instead of JSON.parse(r.body) — k6-native, avoids parse edge cases
 *   - Use http_req_failed built-in metric instead of custom Rate
 *   - Separated status check from body validation to avoid false positives
 *   - Added console.error on failed requests to help debug
 *   - Search body validation updated to match actual response: {posts, users, hashtags, communities}
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend } from 'k6/metrics';

// ─── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:4000';

// ─── Custom timing metrics ──────────────────────────────────────────────────────
const exploreDuration = new Trend('explore_feed_ms', true);
const searchDuration  = new Trend('search_ms',        true);

// ─── Test scenarios ─────────────────────────────────────────────────────────────
export let options = {
  scenarios: {
    // Scenario 1: Baseline — single VU, first request = cache miss, rest = cache hits
    baseline: {
      executor: 'constant-vus',
      vus: 1,
      duration: '20s',
      tags: { scenario: 'baseline' },
    },
    // Scenario 2: Concurrent load — 5 VUs all hitting same endpoint
    //             Redis cache should serve all but first request instantly
    concurrent_load: {
      executor: 'constant-vus',
      vus: 5,
      duration: '30s',
      startTime: '20s',
      tags: { scenario: 'concurrent_load' },
    },
  },
  thresholds: {
    // NFR-PERF-02: Feed endpoints must respond consistently
    'explore_feed_ms':   ['p(95)<500', 'avg<200'],
    // NFR-PERF-01: Search cached queries
    'search_ms':         ['p(95)<500'],
    // Built-in k6 metric: counts status >= 400 OR network failure
    'http_req_failed':   ['rate<0.05'],
    // Overall HTTP duration
    'http_req_duration': ['p(95)<800'],
  },
};

// ─── Main test function ─────────────────────────────────────────────────────────
export default function () {

  // ── Test 1: Explore Feed (NFR-PERF-02: cursor-based pagination) ──────────────
  const exploreRes = http.get(`${BASE_URL}/api/posts?feed=explore`, {
    tags: { name: 'explore_feed' },
  });

  // Check status first (separate from body validation to avoid masking errors)
  const exploreStatusOk = check(exploreRes, {
    '[Explore] status 200': (r) => r.status === 200,
  });

  if (!exploreStatusOk) {
    console.error(`[Explore] Non-200: ${exploreRes.status} — ${exploreRes.body?.substring(0, 300)}`);
  } else {
    // Body validation only runs when status is 200
    const body = exploreRes.json();
    check(body, {
      '[Explore] has posts field':    (b) => b !== null && typeof b === 'object' && 'posts' in b,
      '[Explore] posts is array':     (b) => Array.isArray(b.posts),
      '[Explore] has nextCursor key': (b) => 'nextCursor' in b,
      '[Explore] has hasMore key':    (b) => 'hasMore' in b,
    });
  }

  exploreDuration.add(exploreRes.timings.duration);
  sleep(0.5);

  // ── Test 2: Explore Feed Page 2 (tests cursor pagination — only if cursor exists) ──
  let nextCursor = null;
  try {
    const b = exploreRes.json();
    if (b && b.nextCursor) nextCursor = b.nextCursor;
  } catch { /* no cursor available */ }

  if (nextCursor) {
    const page2Res = http.get(
      `${BASE_URL}/api/posts?feed=explore&cursor=${encodeURIComponent(nextCursor)}`,
      { tags: { name: 'explore_page2' } }
    );
    check(page2Res, {
      '[Explore P2] status 200': (r) => r.status === 200,
    });
    exploreDuration.add(page2Res.timings.duration);
    sleep(0.3);
  }

  // ── Test 3: Search Endpoint (NFR-PERF-01: Redis-cached search results) ────────
  // Confirmed response structure: { posts: [], users: [], hashtags: [], communities: [] }
  const searchRes = http.get(`${BASE_URL}/api/search?q=breadit`, {
    tags: { name: 'search' },
  });

  const searchStatusOk = check(searchRes, {
    '[Search] status 200': (r) => r.status === 200,
  });

  if (!searchStatusOk) {
    console.error(`[Search] Non-200: ${searchRes.status} — ${searchRes.body?.substring(0, 300)}`);
  } else {
    const body = searchRes.json();
    check(body, {
      '[Search] has posts key':       (b) => b !== null && 'posts' in b,
      '[Search] has users key':       (b) => 'users' in b,
      '[Search] has hashtags key':    (b) => 'hashtags' in b,
      '[Search] has communities key': (b) => 'communities' in b,
    });
  }

  searchDuration.add(searchRes.timings.duration);
  sleep(0.5);
}

// ─── Summary report ─────────────────────────────────────────────────────────────
export function handleSummary(data) {
  const explore = data.metrics['explore_feed_ms'];
  const search  = data.metrics['search_ms'];
  const failed  = data.metrics['http_req_failed'];

  const fmt = (v) => v !== undefined ? v.toFixed(2) + ' ms' : 'N/A';

  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║   BREADIT — NFR PERFORMANCE SUMMARY      ║');
  console.log('╚══════════════════════════════════════════╝');

  if (explore) {
    console.log('\n[NFR-PERF-02] Explore Feed (cursor-based pagination):');
    console.log(`  Avg : ${fmt(explore.values['avg'])}`);
    console.log(`  p50 : ${fmt(explore.values['med'])}`);
    console.log(`  p95 : ${fmt(explore.values['p(95)'])}`);
    console.log(`  p99 : ${fmt(explore.values['p(99)'])}`);
    console.log(`  Min : ${fmt(explore.values['min'])}`);
    console.log(`  Max : ${fmt(explore.values['max'])}`);
  }

  if (search) {
    console.log('\n[NFR-PERF-01] Search Endpoint (Redis-cached):');
    console.log(`  Avg : ${fmt(search.values['avg'])}`);
    console.log(`  p95 : ${fmt(search.values['p(95)'])}`);
  }

  if (failed) {
    const failRate = (failed.values['rate'] * 100).toFixed(2);
    console.log(`\n[Reliability] HTTP failure rate: ${failRate}%`);
    if (parseFloat(failRate) > 1) {
      console.log('  ⚠ Run again with console.error output to see which requests failed.');
    }
  }

  console.log('\n══════════════════════════════════════════\n');

  // Return empty object — no file output (avoids Windows path issues)
  return {};
}
