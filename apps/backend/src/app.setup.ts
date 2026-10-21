import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import * as path from 'path';
import { AllExceptionsFilter } from './all-exceptions.filter';

/** Same limit for the request body and for one uploaded file. */
export const MAX_UPLOAD_BYTES = 500 * 1024 * 1024;

/**
 * Everything the app needs apart from creating it and listening on a port.
 * Used by `main.ts` and by the integration tests, so tests run the real setup.
 */
export async function setupApp(app: NestFastifyApplication, uploadDir: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyCookie as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: MAX_UPLOAD_BYTES,
      files: 10,
      fields: 10,
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyStatic as any, {
    root: path.resolve(uploadDir),
    prefix: '/uploads/',
  });

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useWebSocketAdapter(new IoAdapter(app));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
}
