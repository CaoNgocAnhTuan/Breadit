/**
 * Environment for integration tests. Loaded before any test file (jest `setupFiles`),
 * so it is in place before `AppModule` reads `process.env` at import time.
 *
 * Isolation: Postgres schema `it_test` (the dev data in `public` is never touched)
 * and Redis database 1. Override with IT_DATABASE_URL / IT_REDIS_URL if needed.
 */
import * as os from 'os';
import * as path from 'path';

export const IT_SCHEMA = 'it_test';

process.env.DATABASE_URL =
  process.env.IT_DATABASE_URL ??
  `postgresql://breadit:breaditpassword@localhost:5433/breadit?schema=${IT_SCHEMA}`;
process.env.REDIS_URL = process.env.IT_REDIS_URL ?? 'redis://localhost:6378/1';
process.env.REDIS_HTTP_CACHE_ENABLED = 'false';
process.env.JWT_SECRET = 'it-test-secret-it-test-secret-0123456789';
process.env.FRONTEND_URL = 'http://localhost:3000';

// No real email, no Cloudinary: uploads go to a temp folder.
process.env.SMTP_HOST = '127.0.0.1';
process.env.SMTP_PORT = '1';
process.env.SMTP_USERNAME = '';
process.env.SMTP_PASSWORD = '';
process.env.SMTP_FROM = 'it@local.invalid';
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'breadit-it-uploads');
