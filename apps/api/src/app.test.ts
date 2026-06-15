import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

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
});
