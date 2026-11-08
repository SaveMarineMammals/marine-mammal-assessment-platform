import { beforeEach, describe, expect, it, vi } from 'vitest';

const putObject = vi.fn(async (_command?: unknown) => ({}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send(command: { input: unknown }) {
      return putObject(command);
    }
  },
  PutObjectCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

vi.mock('./public-dataset.js', () => ({
  PUBLIC_EXPORT_COLUMNS: ['assessment_id', 'assessment_name'],
  formatCsvRow: (values: Array<string | number | null>) => `${values.join(',')}\n`,
  getPublicStats: async () => ({
    total_assessments: 1,
    total_measurements: 2,
    earliest_assessment: '2026-01-01T00:00:00.000Z',
    latest_assessment: '2026-01-02T00:00:00.000Z',
    protocol_versions: ['1.0.0'],
  }),
  getPublicAssessments: async () => ({
    page: 1,
    limit: 100,
    total: 1,
    items: [
      {
        id: 'a1',
        name: 'M-1',
        assessment_type: 'manatee_v1',
        protocol_version: '1.0.0',
        assessment_started_at: '2026-01-01T00:00:00.000Z',
        assessment_ended_at: null,
        latitude: 17.5,
        longitude: -88.2,
        organization: 'CMARI',
        campaign: '2026',
        measurement_count: 2,
      },
    ],
  }),
  isPublicPseudonymizationEnabled: () => false,
  iteratePublicExportRows: async function* () {
    yield { assessment_id: 'a1', assessment_name: 'M-1' };
  },
}));

describe('writeDatasetSnapshots', () => {
  beforeEach(() => {
    putObject.mockClear();
    process.env.DATA_BUCKET = 'mmap-test-data';
  });

  it('writes stats, assessments, meta, csv, and jsonl under dataset/latest', async () => {
    const { writeDatasetSnapshots } = await import('./dataset-snapshots.js');
    const result = await writeDatasetSnapshots();

    expect(result.bucket).toBe('mmap-test-data');
    expect(result.written).toEqual([
      'dataset/latest/stats.json',
      'dataset/latest/assessments.json',
      'dataset/latest/meta.json',
      'dataset/latest/assessments.csv',
      'dataset/latest/assessments.jsonl',
    ]);
    expect(putObject).toHaveBeenCalledTimes(5);
  });
});
