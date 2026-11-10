import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { FeedService } from '../../src/feed/feed.service';
import { ALGO_METHOD, PRIOR_M, SOCIAL_PARAMS } from '../../src/feed/feed.constants';
import { client, createTestApp } from '../it/helpers/app';
import { closePrisma, cookieFor, prisma } from '../it/helpers/factory';

// TC15 (DW3): the live feed gives the order of the harness. The harness orders were made by `npm run parity` of
// @breadit/eval and are committed in .docs/results/p6-parity/.
//  (a) the full ranked order of FeedService.rank equals the harness order (size, SHA-256 and top 20);
//  (b) the first two pages of GET /api/posts?algo=...&asOf=... equal the harness top 20 (the largest K of section 7).

const DIR = path.resolve(__dirname, '../../../../.docs/results/p6-parity');
const ORDERS = path.resolve(__dirname, '../../../../eval/results/p6-parity/orders.csv');
const ALGOS = ['chrono', 'engagement', 'social'] as const;

interface Pair {
  pair: number;
  userId: string;
  asOfUnix: number;
  poolSize: number;
}
interface Expected {
  pair: number;
  algo: string;
  method: string;
  poolSize: number;
  orderSha256: string;
  top20: number[];
}

const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'manifest.json'), 'utf8'));

function rows(file: string): string[][] {
  const lines = fs.readFileSync(path.join(DIR, file), 'utf8').split('\n');
  expect(lines.pop()).toBe(''); // the file ends with one LF
  return lines.slice(1).map((l) => l.split(','));
}

// pairs.csv: pair,user_id,as_of,as_of_unix,bucket,n_history,n_followees,n_communities,pool_size
const pairs: Pair[] = rows('pairs.csv').map((c) => ({
  pair: Number(c[0]),
  userId: `u${c[1].padStart(10, '0')}`, // the app id of the canonical user
  asOfUnix: Number(c[3]),
  poolSize: Number(c[8]),
}));
// expected.csv: pair,algo,method,pool_size,order_sha256,top20
const expected = new Map<string, Expected>(
  rows('expected.csv').map((c) => [
    `${c[0]}/${c[1]}`,
    { pair: Number(c[0]), algo: c[1], method: c[2], poolSize: Number(c[3]), orderSha256: c[4], top20: c[5].split(' ').map(Number) },
  ]),
);

/** The SHA-256 rule of the parity sample: the ids as decimals joined by "\n", no final newline. */
const orderSha256 = (ids: readonly number[]) => createHash('sha256').update(ids.join('\n'), 'utf8').digest('hex');
const sha256OfFile = (file: string) => createHash('sha256').update(fs.readFileSync(path.join(DIR, file))).digest('hex');

/** Where the live order first differs from the harness order, read from the git-ignored orders.csv when it is there. */
function firstDifference(pair: number, algo: string, live: readonly number[]): string {
  if (!fs.existsSync(ORDERS)) return 'no eval/results/p6-parity/orders.csv: run `npm run parity` to get the full orders';
  const line = fs
    .readFileSync(ORDERS, 'utf8')
    .split('\n')
    .find((l) => l.startsWith(`${pair},${algo},`));
  if (!line) return `pair ${pair} and ${algo} are not in orders.csv`;
  const harness = line.split(',')[2].split(' ').map(Number);
  const n = Math.max(harness.length, live.length);
  for (let i = 0; i < n; i++) {
    if (harness[i] !== live[i]) return `first difference at position ${i + 1}: live ${live[i]}, harness ${harness[i]}`;
  }
  return 'the orders are equal';
}

describe('TC15: parity of the live feed and the harness', () => {
  let app: NestFastifyApplication;
  let feed: FeedService;

  beforeAll(async () => {
    app = await createTestApp();
    feed = app.get(FeedService, { strict: false });
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  // F16: first. A sample made with other params says nothing about this code.
  it('F16: the backend map and params equal the parity sample', () => {
    const want = {
      methods: ALGO_METHOD,
      params: { alpha: SOCIAL_PARAMS.alpha, beta: SOCIAL_PARAMS.beta, m: PRIOR_M },
    };
    try {
      expect({ methods: manifest.methods, params: manifest.params }).toEqual(want);
    } catch (e) {
      throw new Error(`parity sample made with other params: run \`npm run parity -w @breadit/eval\` and commit the result.\n${(e as Error).message}`);
    }
  });

  it('the committed files are the ones the manifest describes: 100 pairs, 300 expected rows', () => {
    expect(pairs).toHaveLength(100);
    expect(expected.size).toBe(300);
    expect(manifest.files['pairs.csv'].rows).toBe(pairs.length);
    expect(manifest.files['expected.csv'].rows).toBe(expected.size);
    expect(sha256OfFile('pairs.csv')).toBe(manifest.files['pairs.csv'].sha256);
    expect(sha256OfFile('expected.csv')).toBe(manifest.files['expected.csv'].sha256);
  });

  for (const p of pairs) {
    it(
      `pair ${p.pair} (${p.userId}, asOf ${p.asOfUnix}): (a) the full order and (b) the first two pages, for each algo`,
      async () => {
        const user = await prisma().user.findUniqueOrThrow({ where: { id: p.userId } });
        const http = client(app, await cookieFor(user));
        const problems: string[] = [];

        for (const algo of ALGOS) {
          const want = expected.get(`${p.pair}/${algo}`) as Expected;
          expect(want).toBeDefined();
          expect(want.poolSize).toBe(p.poolSize);

          // (a) the whole ranked order at the feed module
          const live = (await feed.rank(p.userId, algo, p.asOfUnix)).map((r) => r.id);
          if (live.length !== want.poolSize || orderSha256(live) !== want.orderSha256) {
            problems.push(
              `(a) ${algo}: pool ${live.length} of ${want.poolSize}, ${firstDifference(p.pair, algo, live)}`,
            );
          } else if (live.slice(0, 20).join(' ') !== want.top20.join(' ')) {
            problems.push(`(a) ${algo}: the SHA-256 is equal but the top 20 differs (the sample files do not agree)`);
          }

          // (b) the first two pages over HTTP
          const q = `algo=${algo}&asOf=${p.asOfUnix}`;
          const page1 = await http.get(`/api/posts?${q}&cursor=1`);
          const ids: number[] = page1.status === 200 ? page1.body.posts.map((x: { id: number }) => x.id) : [];
          if (page1.status !== 200) problems.push(`(b) ${algo}: page 1 gave ${page1.status}`);
          else if (page1.body.hasMore) {
            const page2 = await http.get(`/api/posts?${q}&cursor=${encodeURIComponent(page1.body.nextCursor)}`);
            if (page2.status !== 200) problems.push(`(b) ${algo}: page 2 gave ${page2.status}`);
            else ids.push(...page2.body.posts.map((x: { id: number }) => x.id));
          }
          const top = want.top20.slice(0, Math.min(20, want.poolSize));
          if (page1.status === 200 && ids.join(' ') !== top.join(' ')) {
            problems.push(`(b) ${algo}: pages give ${ids.join(' ')}, harness top ${top.length} is ${top.join(' ')}`);
          }
        }
        expect(problems).toEqual([]);
      },
      300_000,
    );
  }
});
