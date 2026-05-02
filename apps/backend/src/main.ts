import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import fastifyCookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './all-exceptions.filter';

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
  const uploadDir = resolveUploadDir();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      bodyLimit: 500 * 1024 * 1024,
    }),
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyCookie as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await app.register(fastifyMultipart as any, {
    limits: {
      fileSize: 500 * 1024 * 1024,
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

  await app.listen(4000, '0.0.0.0');
  console.log('Backend listening on http://0.0.0.0:4000');
}

bootstrap();
