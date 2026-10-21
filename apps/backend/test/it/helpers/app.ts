import { Test } from '@nestjs/testing';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import * as fs from 'fs';
import { AppModule } from '../../../src/app.module';
import { MAX_UPLOAD_BYTES, setupApp } from '../../../src/app.setup';
import { multipart, type MultipartFile } from './multipart';

/** Boots the real app (same setup as `main.ts`) without listening on a port. */
export async function createTestApp(): Promise<NestFastifyApplication> {
  const uploadDir = process.env.UPLOAD_DIR as string;
  fs.mkdirSync(uploadDir, { recursive: true });

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter({ logger: false, bodyLimit: MAX_UPLOAD_BYTES }),
  );
  await setupApp(app, uploadDir);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export type Res = {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  text: string;
  headers: Record<string, unknown>;
};

/**
 * Small HTTP client over Fastify `inject` (no network).
 * `cookie` is the value from `cookieFor(user)`; leave it out for a guest.
 */
export function client(app: NestFastifyApplication, cookie?: string) {
  const fastify = app.getHttpAdapter().getInstance();

  async function send(
    method: string,
    url: string,
    opts: { json?: unknown; payload?: Buffer | string; headers?: Record<string, string> } = {},
  ): Promise<Res> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (cookie) headers.cookie = cookie;
    let payload: Buffer | string | undefined = opts.payload;
    if (opts.json !== undefined) {
      payload = JSON.stringify(opts.json);
      headers['content-type'] = 'application/json';
    }
    const res = await fastify.inject({
      method: method as 'GET',
      url,
      headers,
      payload,
    });
    let body: unknown = undefined;
    try {
      body = res.payload ? JSON.parse(res.payload) : undefined;
    } catch {
      body = undefined;
    }
    return { status: res.statusCode, body, text: res.payload, headers: res.headers };
  }

  return {
    get: (url: string) => send('GET', url),
    post: (url: string, json?: unknown) => send('POST', url, json === undefined ? {} : { json }),
    patch: (url: string, json?: unknown) => send('PATCH', url, json === undefined ? {} : { json }),
    delete: (url: string) => send('DELETE', url),
    /** multipart/form-data, for post, comment, upload and image routes */
    form: (
      method: 'POST' | 'PATCH',
      url: string,
      fields: Record<string, string> = {},
      files: MultipartFile[] = [],
    ) => {
      const m = multipart(fields, files);
      return send(method, url, { payload: m.payload, headers: m.headers });
    },
  };
}
