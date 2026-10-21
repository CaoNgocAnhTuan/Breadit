import { execSync } from 'child_process';
import * as path from 'path';
import { IT_SCHEMA } from './env';

/**
 * Runs once before the integration tests:
 * 1. apply all migrations to the `it_test` schema,
 * 2. empty every table (this also removes the `humans_v1` demo rows),
 * 3. flush Redis database 1 (throttler counters, caches).
 */
export default async function globalSetup() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./env');
  const backendDir = path.resolve(__dirname, '../..');

  try {
    execSync('npx prisma migrate deploy', {
      cwd: backendDir,
      env: process.env,
      stdio: 'pipe',
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    throw new Error(
      'prisma migrate deploy failed. Is `docker compose up db redis -d` running?\n' +
        `${e.stdout?.toString() ?? ''}\n${e.stderr?.toString() ?? ''}`,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  try {
    const rows: { tablename: string }[] = await prisma.$queryRawUnsafe(
      `select tablename from pg_tables where schemaname = '${IT_SCHEMA}' and tablename <> '_prisma_migrations'`,
    );
    if (rows.length > 0) {
      const list = rows.map((r) => `"${IT_SCHEMA}"."${r.tablename}"`).join(', ');
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
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
