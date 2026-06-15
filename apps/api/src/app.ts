import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { Readable } from 'node:stream';
import { MANATEE_V1_PROTOCOL, getProtocolVersion } from '@mmap/schema/manatee_v1';
import { toUtcIso } from '@mmap/geo-time';
import { getCorsOrigins } from './cors.js';
import { listSyncErrors } from './db/repository.js';
import {
  formatCsvRow,
  getPublicAssessments,
  getPublicStats,
  isPublicPseudonymizationEnabled,
  iteratePublicExportRows,
  parseBbox,
  PUBLIC_EXPORT_COLUMNS,
} from './services/public-dataset.js';
import { getBatchHttpStatus, processSyncBatch } from './services/sync-batch.js';

export interface ApiConfig {
  port: number;
  host: string;
}

export interface CreateAppOptions {
  enableAdminRoutes?: boolean;
}

function isAdminAuthorized(adminToken: string | undefined, requestToken: unknown): boolean {
  return Boolean(adminToken && requestToken === adminToken);
}

function parsePublicFilters(query: Record<string, unknown>) {
  return {
    page: query.page ? Number(query.page) : undefined,
    limit: query.limit ? Number(query.limit) : undefined,
    from: typeof query.from === 'string' ? query.from : undefined,
    to: typeof query.to === 'string' ? query.to : undefined,
    bbox: typeof query.bbox === 'string' ? parseBbox(query.bbox) : undefined,
  };
}

export async function createApp(options: CreateAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  const adminToken = process.env.API_ADMIN_TOKEN;
  const enableAdminRoutes =
    options.enableAdminRoutes ?? (process.env.NODE_ENV !== 'production' || Boolean(adminToken));

  await app.register(cors, {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST', 'OPTIONS'],
  });

  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Marine Mammal Assessment Platform API',
        version: '0.1.0',
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  app.get('/v1/health', async () => ({
    status: 'ok',
    service: 'mmap-api',
    timestamp: toUtcIso(new Date()),
    protocol: {
      type: MANATEE_V1_PROTOCOL,
      version: getProtocolVersion(MANATEE_V1_PROTOCOL),
    },
  }));

  app.get('/health', async (_request, reply) => reply.redirect('/v1/health'));

  app.get('/', async () => ({
    name: 'Marine Mammal Assessment Platform API',
    version: '0.1.0',
    docs: '/docs',
    health: '/v1/health',
    public: {
      stats: '/v1/public/stats',
      assessments: '/v1/public/assessments',
      export: '/v1/public/assessments/export',
    },
  }));

  app.get('/v1/public/meta', async () => ({
    license: 'CC BY 4.0',
    pseudonymization_enabled: isPublicPseudonymizationEnabled(),
    docs: '/docs',
  }));

  app.get('/v1/public/stats', async (_request, reply) => {
    if (!process.env.DATABASE_URL) {
      return reply.code(503).send({ error: 'Database unavailable' });
    }
    return getPublicStats();
  });

  app.get('/v1/public/assessments/export', async (request, reply) => {
    if (!process.env.DATABASE_URL) {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    const query = request.query as Record<string, unknown>;
    const format = typeof query.format === 'string' ? query.format : 'csv';
    if (format !== 'csv' && format !== 'jsonl') {
      return reply.code(400).send({ error: 'format must be csv or jsonl' });
    }

    let filters;
    try {
      filters = parsePublicFilters(query);
    } catch (error) {
      if (error instanceof Error && error.message.includes('bbox')) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }

    const extension = format === 'csv' ? 'csv' : 'jsonl';
    const filename = `mmap-export-${toUtcIso(new Date()).slice(0, 10)}.${extension}`;

    if (format === 'jsonl') {
      const stream = Readable.from(
        (async function* jsonlStream() {
          for await (const row of iteratePublicExportRows(filters)) {
            yield `${JSON.stringify(row)}\n`;
          }
        })(),
      );
      return reply
        .header('Content-Type', 'application/x-ndjson; charset=utf-8')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(stream);
    }

    const stream = Readable.from(
      (async function* csvStream() {
        yield formatCsvRow([...PUBLIC_EXPORT_COLUMNS]);
        for await (const row of iteratePublicExportRows(filters)) {
          yield formatCsvRow(PUBLIC_EXPORT_COLUMNS.map((column) => row[column] ?? null));
        }
      })(),
    );

    return reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(stream);
  });

  app.get('/v1/public/assessments', async (request, reply) => {
    if (!process.env.DATABASE_URL) {
      return reply.code(503).send({ error: 'Database unavailable' });
    }

    try {
      const query = request.query as Record<string, unknown>;
      return await getPublicAssessments(parsePublicFilters(query));
    } catch (error) {
      if (error instanceof Error && error.message.includes('bbox')) {
        return reply.code(400).send({ error: error.message });
      }
      throw error;
    }
  });

  app.post('/v1/sync/batch', {
    schema: {
      body: {
        type: 'object',
        properties: {
          assessments: { type: 'array', items: { type: 'object' } },
          measurements: { type: 'array', items: { type: 'object' } },
        },
      },
    },
    handler: async (request, reply) => {
      const body = request.body as { assessments?: unknown[]; measurements?: unknown[] };
      const response = await processSyncBatch(body);
      const statusCode = getBatchHttpStatus(response.results);
      return reply.code(statusCode).send(response);
    },
  });

  if (enableAdminRoutes) {
    app.get('/v1/admin/sync-errors', async (request, reply) => {
      if (!isAdminAuthorized(adminToken, request.headers['x-admin-token'])) {
        return reply.code(401).send({ error: 'Unauthorized' });
      }

      const errors = await listSyncErrors();
      return { errors };
    });
  }

  return app;
}

export async function startServer(config: ApiConfig = { port: 3001, host: '0.0.0.0' }) {
  const app = await createApp();
  await app.listen({ port: config.port, host: config.host });
  return app;
}
