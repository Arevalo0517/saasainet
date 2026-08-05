import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

describe('HealthController (Fase 0)', () => {
  let app: INestApplication;

  it('responde 200 en /api/v1/health', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();

    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      timestamp: expect.any(String),
    });
    expect(['ok', 'degraded']).toContain(res.body.status);

    await app.close();
  });
});
