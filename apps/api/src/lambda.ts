import awsLambdaFastify from '@fastify/aws-lambda';
import type { Context, Handler } from 'aws-lambda';
import { createApp } from './app.js';
import { runMigrations } from './db/migrate.js';
import { writeDatasetSnapshots } from './services/dataset-snapshots.js';

type LambdaProxy = (event: unknown, context: Context) => Promise<unknown>;

const appPromise = createApp();
let proxy: LambdaProxy | null = null;
let migrated = false;

async function getProxy(): Promise<LambdaProxy> {
  if (!proxy) {
    const app = await appPromise;
    proxy = awsLambdaFastify(app, {
      binaryMimeTypes: ['application/octet-stream'],
    }) as LambdaProxy;
  }
  return proxy;
}

async function prepareDatabase(): Promise<void> {
  if (!migrated && process.env.DATABASE_URL) {
    await runMigrations();
    migrated = true;
  }
}

function eventJob(event: unknown): string | undefined {
  if (!event || typeof event !== 'object') {
    return undefined;
  }
  const record = event as Record<string, unknown>;
  if (typeof record.job === 'string') {
    return record.job;
  }
  if (record.source === 'aws.events') {
    return 'dataset-export';
  }
  return undefined;
}

export const handler: Handler = async (event, context) => {
  const job = eventJob(event);
  if (job === 'dataset-export') {
    await prepareDatabase();
    const result = await writeDatasetSnapshots();
    return { ok: true, ...result };
  }

  await prepareDatabase();
  const lambdaProxy = await getProxy();
  return lambdaProxy(event, context);
};
