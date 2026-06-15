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
        <h1>Public Dataset</h1>
        <p className="lede">
          Read-only exports of synced assessments and measurements. License:{' '}
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
            <span className="stat-card__label">Schema</span>
            <strong className="stat-card__value stat-card__value--small">
              {MANATEE_V1_PROTOCOL} {MANATEE_V1_VERSION}
              {stats.protocol_versions.length > 0 ? ` (${stats.protocol_versions.join(', ')})` : ''}
            </strong>
          </div>
        </section>
      ) : null}

      <section className="panel">
        <h2>Download</h2>
        <p className="hint">
          Bulk exports include assessment metadata and flattened measurement rows.{' '}
          {meta?.pseudonymization_enabled
            ? 'Assessment names are pseudonymized in public exports.'
            : 'Configure PUBLIC_PSEUDONYMIZE_NAMES on the API to pseudonymize names.'}
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
            API docs
          </a>
        </div>
      </section>

      {records ? (
        <section className="panel">
          <h2>Sample records</h2>
          <p className="hint">
            Page {records.page} · showing {records.items.length} of {records.total}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Started (UTC)</th>
                  <th scope="col">Location</th>
                  <th scope="col">Measurements</th>
                </tr>
              </thead>
              <tbody>
                {records.items.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      No synced records yet. Seed the API or sync from the field app.
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
