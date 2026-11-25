import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { readJwtSecret } from './auth/auth.config';
import { MAX_UPLOAD_BYTES, setupApp } from './app.setup';

function resolveUploadDir(): string {
  const desired = process.env.UPLOAD_DIR ?? '/var/lib/breadit/uploads';
  try {
    fs.mkdirSync(desired, { recursive: true });
    return desired;
  } catch (err) {
    const fallback = path.resolve(process.cwd(), 'uploads');
    console.warn(
      `[uploads] cannot use ${desired} (${(err as Error).message}); falling back to ${fallback}`,
    );
    fs.mkdirSync(fallback, { recursive: true });
    process.env.UPLOAD_DIR = fallback;
    return fallback;
  }
}

async function bootstrap() {
  // S6.1: a missing or weak JWT_SECRET in production stops the backend here, not at the first login.
  readJwtSecret(process.env);

  const uploadDir = resolveUploadDir();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: MAX_UPLOAD_BYTES,
    }),
  );

  await setupApp(app, uploadDir);

  await app.listen(4000, '0.0.0.0');
  console.log('Backend listening on http://0.0.0.0:4000');
}

bootstrap();
