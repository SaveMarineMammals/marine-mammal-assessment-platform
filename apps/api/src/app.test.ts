import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from './app.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe('@mmap/api', () => {
  it('returns ok from /v1/health', async () => {
    const app = await createApp({ enableAdminRoutes: false });

    const response = await app.inject({ method: 'GET', url: '/v1/health' });

    expect(response.statusCode).toBe(200);

    const body = response.json<{ status: string; service: string }>();
    expect(body.status).toBe('ok');
    expect(body.service).toBe('mmap-api');

    await app.close();
  });

  it('allows CORS preflight from the field app origin', async () => {
    const app = await createApp({ enableAdminRoutes: false });

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/v1/sync/batch',
      headers: {
        origin: 'http://localhost:5174',
        'access-control-request-method': 'POST',
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5174');

    await app.close();
  });

  it('serves OpenAPI Swagger UI under /api/docs', async () => {
    const app = await createApp({ enableAdminRoutes: false });

    const response = await app.inject({ method: 'GET', url: '/api/docs/' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    // Relative asset URLs resolve under /api/docs/* (CDN/nginx route that prefix to the API).
    expect(response.body).toContain('./static/swagger-ui.css');

    await app.close();
  });

  it('uses packaged swagger-ui static dir when LAMBDA_TASK_ROOT is set', async () => {
    const taskRoot = mkdtempSync(join(tmpdir(), 'mmap-lambda-static-'));
    tempDirs.push(taskRoot);
    const staticDir = join(taskRoot, 'static');
    mkdirSync(staticDir);
    writeFileSync(join(staticDir, 'index.html'), '<html></html>');
    writeFileSync(join(staticDir, 'logo.svg'), '<svg></svg>');

    const previous = process.env.LAMBDA_TASK_ROOT;
    process.env.LAMBDA_TASK_ROOT = taskRoot;

    try {
      const app = await createApp({ enableAdminRoutes: false });
      const response = await app.inject({ method: 'GET', url: '/api/docs/' });
      expect(response.statusCode).toBe(200);
      await app.close();
    } finally {
      if (previous === undefined) {
        delete process.env.LAMBDA_TASK_ROOT;
      } else {
        process.env.LAMBDA_TASK_ROOT = previous;
      }
    }
  });
});
