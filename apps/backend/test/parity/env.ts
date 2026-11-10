/**
 * Environment of the parity test (design: Approach, "Parity test (backend)"). Loaded before any test file
 * (jest `setupFiles`), so it is in place before `AppModule` reads `process.env` at import time.
 *
 * The test reads the schema `eval_load`, where `npm run load -w @breadit/eval -- syn-W2M-M` put the dataset. It never
 * writes it. Redis database 2 is used only here. Override with PARITY_DATABASE_URL / PARITY_REDIS_URL if needed.
 */
import * as os from 'os';
import * as path from 'path';

export const PARITY_SCHEMA = 'eval_load';

const databaseUrl =
  process.env.PARITY_DATABASE_URL ??
  `postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=${PARITY_SCHEMA}`;
// The loader writes only `eval_*` schemas, and so does this test: a URL for `public` or `it_test` is a mistake.
const schema = new URL(databaseUrl).searchParams.get('schema') ?? '';
if (!schema.startsWith('eval_')) {
  throw new Error(`the parity test reads an eval_* schema, but the database URL has schema "${schema}"`);
}
process.env.DATABASE_URL = databaseUrl;
process.env.REDIS_URL = process.env.PARITY_REDIS_URL ?? 'redis://localhost:6378/2';
process.env.REDIS_HTTP_CACHE_ENABLED = 'false';
process.env.JWT_SECRET = 'it-test-secret-it-test-secret-0123456789';
process.env.FRONTEND_URL = 'http://localhost:3000';

// The test-only `asOf` parameter is on, and a default algo from the shell cannot leak in.
process.env.FEED_ASOF_ENABLED = 'true';
delete process.env.FEED_DEFAULT_ALGO;

// No real email, no Cloudinary: uploads go to a temp folder.
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_USERNAME = '';
process.env.SMTP_PASSWORD = '';
process.env.SMTP_FROM = 'parity@local.invalid';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'breadit-parity-uploads');
