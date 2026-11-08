import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { toUtcIso } from '@mmap/geo-time';
import {
  formatCsvRow,
  getPublicAssessments,
  getPublicStats,
  isPublicPseudonymizationEnabled,
  iteratePublicExportRows,
  PUBLIC_EXPORT_COLUMNS,
} from './public-dataset.js';

export const DATASET_SNAPSHOT_PREFIX = 'dataset/latest';

export interface DatasetSnapshotResult {
  bucket: string;
  prefix: string;
  written: string[];
  generated_at: string;
}

function requireBucket(): string {
  const bucket = process.env.DATA_BUCKET?.trim() || process.env.DATASET_BUCKET?.trim();
  if (!bucket) {
    throw new Error('DATA_BUCKET (or DATASET_BUCKET) is required to write dataset snapshots');
  }
  return bucket;
}

async function putText(
  client: S3Client,
  bucket: string,
  key: string,
  body: string,
  contentType: string,
): Promise<void> {
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      CacheControl: 'public, max-age=300',
    }),
  );
}

/** Build stats, assessment list, meta, CSV, and JSONL snapshots under dataset/latest/. */
export async function writeDatasetSnapshots(
  client: S3Client = new S3Client({}),
): Promise<DatasetSnapshotResult> {
  const bucket = requireBucket();
  const prefix = DATASET_SNAPSHOT_PREFIX;
  const generatedAt = toUtcIso(new Date());
  const written: string[] = [];

  const [stats, assessments] = await Promise.all([
    getPublicStats(),
    getPublicAssessments({ page: 1, limit: 100 }),
  ]);

  const meta = {
    license: 'CC BY 4.0',
    pseudonymization_enabled: isPublicPseudonymizationEnabled(),
    docs: '/api/docs',
    generated_at: generatedAt,
    source: 'daily-snapshot',
  };

  const statsKey = `${prefix}/stats.json`;
  await putText(
    client,
    bucket,
    statsKey,
    `${JSON.stringify({ ...stats, generated_at: generatedAt }, null, 2)}\n`,
    'application/json; charset=utf-8',
  );
  written.push(statsKey);

  const assessmentsKey = `${prefix}/assessments.json`;
  await putText(
    client,
    bucket,
    assessmentsKey,
    `${JSON.stringify({ ...assessments, generated_at: generatedAt }, null, 2)}\n`,
    'application/json; charset=utf-8',
  );
  written.push(assessmentsKey);

  const metaKey = `${prefix}/meta.json`;
  await putText(
    client,
    bucket,
    metaKey,
    `${JSON.stringify(meta, null, 2)}\n`,
    'application/json; charset=utf-8',
  );
  written.push(metaKey);

  const csvChunks: string[] = [formatCsvRow([...PUBLIC_EXPORT_COLUMNS])];
  const jsonlChunks: string[] = [];
  for await (const row of iteratePublicExportRows({})) {
    csvChunks.push(formatCsvRow(PUBLIC_EXPORT_COLUMNS.map((column) => row[column] ?? null)));
    jsonlChunks.push(`${JSON.stringify(row)}\n`);
  }

  const csvKey = `${prefix}/assessments.csv`;
  await putText(client, bucket, csvKey, csvChunks.join(''), 'text/csv; charset=utf-8');
  written.push(csvKey);

  const jsonlKey = `${prefix}/assessments.jsonl`;
  await putText(
    client,
    bucket,
    jsonlKey,
    jsonlChunks.join(''),
    'application/x-ndjson; charset=utf-8',
  );
  written.push(jsonlKey);

  return { bucket, prefix, written, generated_at: generatedAt };
}
