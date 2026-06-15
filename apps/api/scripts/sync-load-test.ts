import { randomUUID } from 'node:crypto';
import { resolveDatabaseUrl } from '../src/cli/database-url.js';
import { runMigrations } from '../src/db/migrate.js';
import { closePool } from '../src/db/pool.js';
import { createApp } from '../src/app.js';
import { MANATEE_V1_PROTOCOL, MANATEE_V1_VERSION } from '@mmap/schema/manatee_v1';

const ASSESSMENT_COUNT = 50;
const MEASUREMENTS_PER_ASSESSMENT = 10;
const MAX_DURATION_MS = 30_000;
const COLLECTOR_ID = '770e8400-e29b-41d4-a716-446655440000';

resolveDatabaseUrl();
await runMigrations();

const app = await createApp({ enableAdminRoutes: false });
await app.listen({ port: 3098, host: '127.0.0.1' });

const assessments = Array.from({ length: ASSESSMENT_COUNT }, (_, index) => ({
  id: randomUUID(),
  name: `Load-Test-${index + 1}`,
  assessment_type: MANATEE_V1_PROTOCOL,
  protocol_version: MANATEE_V1_VERSION,
  assessment_started_at: '2026-03-15T14:00:00.000Z',
  assessment_ended_at: '2026-03-15T15:00:00.000Z',
  location: { latitude: 17.5 + index * 0.001, longitude: -88.2 },
  collector_id: COLLECTOR_ID,
  sync_status: 'pending' as const,
}));

const measurements = assessments.flatMap((assessment) =>
  Array.from({ length: MEASUREMENTS_PER_ASSESSMENT }, (_, index) => ({
    id: randomUUID(),
    assessment_id: assessment.id,
    measurement_type: 'heart_rate' as const,
    recorded_at: `2026-03-15T14:${String(index).padStart(2, '0')}:00.000Z`,
    value: 50 + index,
    unit: 'bpm' as const,
  })),
);

const startedAt = Date.now();
const response = await fetch('http://127.0.0.1:3098/v1/sync/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ assessments, measurements }),
});
const elapsedMs = Date.now() - startedAt;

if (!response.ok) {
  console.error(`Load test failed with HTTP ${response.status}`);
  console.error(await response.text());
  process.exitCode = 1;
} else {
  const body = (await response.json()) as { results: Array<{ status: string }> };
  const failed = body.results.filter((result) => result.status === 'error').length;
  console.log(
    `Synced ${assessments.length} assessments and ${measurements.length} measurements in ${elapsedMs}ms (${failed} failures).`,
  );

  if (failed > 0 || elapsedMs > MAX_DURATION_MS) {
    process.exitCode = 1;
  }
}

await app.close();
await closePool();
