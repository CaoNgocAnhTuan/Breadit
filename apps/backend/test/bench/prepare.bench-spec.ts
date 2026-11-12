import * as fs from 'fs';
import * as path from 'path';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { ALGO_METHOD, POOL_PARAMS, PRIOR_M, SOCIAL_PARAMS } from '../../src/feed/feed.constants';
import { PrismaService } from '../../src/prisma/prisma.service';
import { client, createTestApp } from '../it/helpers/app';
import { closePrisma, cookieFor, prisma } from '../it/helpers/factory';
import { CountingPrisma } from './counting-prisma';
import { E7_OUT } from './env';

// The prepare step of E7 (task p7-cost-benchmark, design: Approach "Three steps", step 1).
// It counts the Prisma queries of each feed request over Fastify `inject`, one request at a time, and writes the
// raw files that `scripts/e7/run-e7.mjs` and `npm run e7:summary -w @breadit/eval` read:
//   queries-raw.csv, params.json, sessions.json  (in E7_OUT, git-ignored).
//  TC2: a known request gives a query count above 0 (the query events fire in the subclass).
//  TC3: two full passes over 100 pairs x 3 algos give the same count for every (pair, algo).

const PARITY_DIR = path.resolve(__dirname, '../../../../.docs/results/p6-parity');
const ALGOS = ['chrono', 'engagement', 'social'] as const;
type Algo = (typeof ALGOS)[number];

interface Pair {
  pair: number;
  userId: string;
  asOfUnix: number;
}

// pairs.csv: pair,user_id,as_of,as_of_unix,bucket,n_history,n_followees,n_communities,pool_size
const lines = fs.readFileSync(path.join(PARITY_DIR, 'pairs.csv'), 'utf8').split('\n');
lines.pop(); // the file ends with one LF
const pairs: Pair[] = lines.slice(1).map((l) => {
  const c = l.split(',');
  return { pair: Number(c[0]), userId: `u${c[1].padStart(10, '0')}`, asOfUnix: Number(c[3]) };
});

interface Measure {
  pair: number;
  userId: string;
  asOfUnix: number;
  algo: Algo;
  status: number;
  postsOnPage: number;
  queries: number;
}

describe('E7 prepare step: Prisma queries per feed request', () => {
  let app: NestFastifyApplication;
  let counter: CountingPrisma;
  const cookies = new Map<string, string>();

  async function measure(p: Pair, algo: Algo): Promise<Measure> {
    const http = client(app, cookies.get(p.userId));
    counter.reset();
    const res = await http.get(`/api/posts?algo=${algo}&asOf=${p.asOfUnix}`);
    const queries = counter.count();
    const postsOnPage = res.status === 200 ? (res.body.posts as unknown[]).length : -1;
    return { pair: p.pair, userId: p.userId, asOfUnix: p.asOfUnix, algo, status: res.status, postsOnPage, queries };
  }

  async function pass(): Promise<Measure[]> {
    const out: Measure[] = [];
    for (const p of pairs) for (const algo of ALGOS) out.push(await measure(p, algo));
    return out;
  }

  beforeAll(async () => {
    app = await createTestApp([{ provide: PrismaService, useClass: CountingPrisma }]);
    counter = app.get(PrismaService, { strict: false }) as CountingPrisma;
    for (const p of pairs) {
      const user = await prisma().user.findUniqueOrThrow({ where: { id: p.userId } });
      cookies.set(p.userId, await cookieFor(user));
    }
  }, 120_000);

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  it('the sample is the 100 parity pairs', () => {
    expect(pairs).toHaveLength(100);
  });

  it('TC2: a known request (pair 1, chrono) gives a query count above 0', async () => {
    const m = await measure(pairs[0], 'chrono');
    expect(m.status).toBe(200);
    expect(m.queries).toBeGreaterThan(0);
  });

  it(
    'TC3: two passes over 100 pairs x 3 algos give the same count, every response is 200, queries-raw.csv has 300 rows',
    async () => {
      const first = await pass();
      const second = await pass();
      expect(first).toHaveLength(300);

      const notOk = first.filter((m) => m.status !== 200).map((m) => `pair ${m.pair} ${m.algo}: ${m.status}`);
      expect(notOk).toEqual([]);

      // F8: a count that moves means something in the request is not fixed.
      const moved = first.flatMap((m, i) =>
        m.queries !== second[i].queries ? [`pair ${m.pair} ${m.algo}: ${m.queries} then ${second[i].queries}`] : [],
      );
      expect(moved).toEqual([]);
      expect(first.every((m) => m.queries > 0)).toBe(true);

      fs.mkdirSync(E7_OUT, { recursive: true });
      const csv = [
        'pair,user_id,as_of_unix,algo,status,posts_on_page,queries',
        ...first.map((m) => [m.pair, m.userId, m.asOfUnix, m.algo, m.status, m.postsOnPage, m.queries].join(',')),
      ].join('\n');
      fs.writeFileSync(path.join(E7_OUT, 'queries-raw.csv'), `${csv}\n`);
      expect(fs.readFileSync(path.join(E7_OUT, 'queries-raw.csv'), 'utf8').trimEnd().split('\n')).toHaveLength(301);
    },
    600_000,
  );

  it('writes params.json and sessions.json', () => {
    fs.mkdirSync(E7_OUT, { recursive: true });
    const params = { ALGO_METHOD, SOCIAL_PARAMS, PRIOR_M, POOL_PARAMS };
    fs.writeFileSync(path.join(E7_OUT, 'params.json'), `${JSON.stringify(params, null, 2)}\n`);
    const sessions = Object.fromEntries([...cookies.entries()].sort(([a], [b]) => (a < b ? -1 : 1)));
    fs.writeFileSync(path.join(E7_OUT, 'sessions.json'), `${JSON.stringify(sessions, null, 2)}\n`);
    expect(Object.keys(sessions)).toHaveLength(100);
  });
});
