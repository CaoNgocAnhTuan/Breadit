import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { closePrisma } from './helpers/factory';
import { client, createTestApp } from './helpers/app';

describe('integration setup', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
    await closePrisma();
  });

  it('boots the real app and answers GET /api/health', async () => {
    const res = await client(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('answers 401 on a protected route without a cookie', async () => {
    const res = await client(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
