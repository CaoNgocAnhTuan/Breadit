import * as fs from 'fs';
import * as path from 'path';

/**
 * Runs once before the parity test. It never migrates and never empties a table.
 * 1. Checks that `eval_load` holds syn-W2M-M as the loader wrote it (no `--rebase-to`): the row counts and the first
 *    post time equal the parity manifest (F1).
 * 2. Flushes Redis database 2 (throttler counters), so the 600 HTTP calls start at 0 (F18).
 */
export const PARITY_DIR = path.resolve(__dirname, '../../../../.docs/results/p6-parity');

export default async function globalSetup() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./env');

  const manifestPath = path.join(PARITY_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`parity sample not found: ${manifestPath}. Run \`npm run parity -w @breadit/eval -- --param alpha=<v> --param beta=<v>\``);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
    dataset: { id: string };
    counts: { users: number; posts: number; interactions: number };
    firstPostUnix: number;
  };

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const [users, posts, likes, comments, reposts, first] = await Promise.all([
      prisma.user.count(),
      prisma.post.count({ where: { rePostId: null } }),
      prisma.like.count(),
      prisma.comment.count(),
      prisma.post.count({ where: { rePostId: { not: null } } }),
      prisma.post.aggregate({ _min: { createdAt: true }, where: { rePostId: null } }),
    ]);
    const firstPostUnix = first._min.createdAt ? Math.floor(first._min.createdAt.getTime() / 1000) : null;
    const found = { users, posts, interactions: likes + comments + reposts, firstPostUnix };
    const want = { users: manifest.counts.users, posts: manifest.counts.posts, interactions: manifest.counts.interactions, firstPostUnix: manifest.firstPostUnix };
    if (JSON.stringify(found) !== JSON.stringify(want)) {
      throw new Error(
        `The schema eval_load does not hold ${manifest.dataset.id} as the parity sample expects ` +
          `(found ${JSON.stringify(found)}, expected ${JSON.stringify(want)}). ` +
          `Run \`npm run load -w @breadit/eval -- ${manifest.dataset.id}\` (without --rebase-to) and run the parity test again.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Redis = require('ioredis');
  const redis = new Redis(process.env.REDIS_URL);
  await redis.flushdb();
  await redis.quit();
}
