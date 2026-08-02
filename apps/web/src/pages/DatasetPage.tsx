import { useEffect, useState } from 'react';
import { MANATEE_V1_PROTOCOL, MANATEE_V1_VERSION } from '@mmap/schema/manatee_v1';
import {
  fetchPublicAssessments,
  fetchPublicMeta,
  fetchPublicStats,
  getExportUrl,
  getOpenApiUrl,
  type PublicAssessmentListResponse,
  type PublicDatasetStats,
  type PublicMeta,
} from '../lib/config.js';

function formatDate(value: string | null): string {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function DatasetPage() {
  const [stats, setStats] = useState<PublicDatasetStats | null>(null);
  const [meta, setMeta] = useState<PublicMeta | null>(null);
  const [records, setRecords] = useState<PublicAssessmentListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [nextStats, nextMeta, nextRecords] = await Promise.all([
          fetchPublicStats(),
          fetchPublicMeta(),
          fetchPublicAssessments(1, 10),
        ]);
        if (!cancelled) {
          setStats(nextStats);
          setMeta(nextMeta);
          setRecords(nextRecords);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Failed to load dataset');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="page">
      <header className="page-header">
        <h1>Public dataset</h1>
        <p className="lede">
          Browse and download published assessments from field teams. License:{' '}
          {meta?.license ?? 'CC BY 4.0'}.
        </p>
      </header>

      {loading ? <p className="status">Loading dataset summary…</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      {stats ? (
        <section className="stats-grid" aria-label="Dataset summary">
          <div className="stat-card">
            <span className="stat-card__label">Assessments</span>
            <strong className="stat-card__value">{stats.total_assessments}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Measurements</span>
            <strong className="stat-card__value">{stats.total_measurements}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Date range</span>
            <strong className="stat-card__value stat-card__value--small">
              {formatDate(stats.earliest_assessment)} → {formatDate(stats.latest_assessment)}
            </strong>
          </div>
          <div className="stat-card">
            <span className="stat-card__label">Protocol</span>
            <strong className="stat-card__value stat-card__value--small">
              Manatee health assessment
              {stats.protocol_versions.length > 0
                ? ` (${stats.protocol_versions.join(', ')})`
                : ` (${MANATEE_V1_PROTOCOL} ${MANATEE_V1_VERSION})`}
            </strong>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Download</h2>
        <p className="hint">
          Downloads include assessment details and measurement rows for analysis in a spreadsheet or
          stats tools.{' '}
          {meta?.pseudonymization_enabled
            ? 'Animal or assessment names may be anonymized in public downloads.'
            : null}
        </p>
        <div className="cta-row">
          <a className="button button--primary" href={getExportUrl('csv')}>
            Download CSV
          </a>
          <a className="button button--secondary" href={getExportUrl('jsonl')}>
            Download JSONL
          </a>
          <a
            className="button button--ghost"
            href={getOpenApiUrl()}
            target="_blank"
            rel="noreferrer"
          >
            Technical API reference
          </a>
        </div>
      </section>

      {records ? (
        <section className="panel">
          <h2>Recent assessments</h2>
          <p className="hint">
            Showing {records.items.length} of {records.total}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Started</th>
                  <th scope="col">Location</th>
                  <th scope="col">Measurements</th>
                </tr>
              </thead>
              <tbody>
                {records.items.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      No published assessments yet. After field teams sync, records will appear
                      here.
                    </td>
                  </tr>
                ) : (
                  records.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{formatDate(item.assessment_started_at)}</td>
                      <td>
                        {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                      </td>
                      <td>{item.measurement_count}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </article>
  );
}
