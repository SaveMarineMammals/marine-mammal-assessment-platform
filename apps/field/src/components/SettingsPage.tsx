import { useEffect, useRef, useState } from 'react';
import { HelpLink } from './HelpLink.js';
import {
  clearAllData,
  downloadBackupFile,
  exportBackup,
  getStorageSummary,
  importBackup,
  type DuplicateStrategy,
  type ImportResult,
  type StorageSummary,
} from '../data/backup.js';
import { parseBackupJson } from '../data/backup-types.js';
import { addFeedback, exportFeedbackJson, listFeedback } from '../data/repository.js';
import { getApiBaseUrlDisplay } from '../config.js';
import { useNavigationRefresh } from '../context/NavigationRefreshContext.js';
import { useSync } from '../hooks/useSync.js';
import { listFailedSyncEntries } from '../sync/sync-service.js';
import type { FieldFeedbackEntry, SyncQueueEntry } from '../db/types.js';
import {
  applyGloveModeClass,
  getDevProtocolKey,
  getGloveMode,
  setDevProtocolKey,
  setGloveMode,
} from '../lib/preferences.js';
import { listProtocolEntries, protocolKeyToString } from '../lib/protocol-registry.js';

interface SettingsPageProps {
  onChanged: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SettingsPage({ onChanged }: SettingsPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [summary, setSummary] = useState<StorageSummary | null>(null);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>('skip');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [failedSyncEntries, setFailedSyncEntries] = useState<SyncQueueEntry[]>([]);
  const [devProtocolKey, setDevProtocolKeyState] = useState(getDevProtocolKey() ?? '');
  const [gloveMode, setGloveModeState] = useState(getGloveMode());
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackContext, setFeedbackContext] = useState('');
  const [feedbackEntries, setFeedbackEntries] = useState<FieldFeedbackEntry[]>([]);
  const { refreshKey } = useNavigationRefresh();
  const { isSyncing, syncNow, retryFailed, lastResult } = useSync(refreshKey);

  async function refreshSummary() {
    const nextSummary = await getStorageSummary();
    setSummary(nextSummary);
    const failed = await listFailedSyncEntries();
    setFailedSyncEntries(failed);
    const feedback = await listFeedback();
    setFeedbackEntries(feedback);
  }

  useEffect(() => {
    refreshSummary().catch(() => setSummary(null));
  }, []);

  async function handleExport() {
    setError(null);
    setStatus(null);
    setImportResult(null);

    try {
      setIsExporting(true);
      const backup = await exportBackup();
      downloadBackupFile(backup);
      setStatus('Backup downloaded successfully.');
      await refreshSummary();
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : 'Export failed.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleImportFile(file: File) {
    setError(null);
    setStatus(null);
    setImportResult(null);

    try {
      setIsImporting(true);
      const text = await file.text();
      const parsed = parseBackupJson(JSON.parse(text) as unknown);
      const result = await importBackup(parsed, duplicateStrategy);

      setImportResult(result);

      if (result.errors.length > 0) {
        setError(result.errors.join('\n'));
        return;
      }

      setStatus(
        `Import complete: ${result.importedAssessments} assessments imported, ${result.replacedAssessments} replaced, ${result.skippedAssessments} skipped; ${result.importedMeasurements} measurements imported, ${result.replacedMeasurements} replaced, ${result.skippedMeasurements} skipped.`,
      );
      await refreshSummary();
      onChanged();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Import failed.');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Settings & Backup</h2>
        <HelpLink from="/settings" />
      </div>

      <p className="hint">
        Export a JSON backup before long field days. Import restores assessments and measurements
        after validating against the manatee v1 schema.
      </p>

      {summary ? (
        <dl className="detail-grid storage-summary">
          <div>
            <dt>Assessments</dt>
            <dd>{summary.assessmentCount}</dd>
          </div>
          <div>
            <dt>Measurements</dt>
            <dd>{summary.measurementCount}</dd>
          </div>
          <div>
            <dt>Pending sync</dt>
            <dd>{summary.pendingSyncCount}</dd>
          </div>
          <div>
            <dt>Approx. backup size</dt>
            <dd>{formatBytes(summary.approximateBytes)}</dd>
          </div>
        </dl>
      ) : (
        <p className="empty-state">Loading storage summary…</p>
      )}

      <div className="settings-section">
        <h3>Sync</h3>
        <p className="hint">
          API endpoint: <code>{getApiBaseUrlDisplay()}</code>. Sync runs automatically when online,
          every minute, and when connectivity returns.
        </p>
        <div className="settings-actions">
          <button
            type="button"
            className="button button--primary"
            disabled={isSyncing}
            onClick={() => {
              syncNow()
                .then(() => refreshSummary())
                .catch(() => undefined);
            }}
          >
            {isSyncing ? 'Syncing…' : 'Sync Now'}
          </button>
          {failedSyncEntries.length > 0 ? (
            <button
              type="button"
              className="button button--secondary"
              disabled={isSyncing}
              onClick={() => {
                retryFailed()
                  .then(() => {
                    refreshSummary().catch(() => undefined);
                    onChanged();
                  })
                  .catch(() => undefined);
              }}
            >
              Retry Failed ({failedSyncEntries.length})
            </button>
          ) : null}
        </div>
        {lastResult ? (
          <p className="hint">
            Last sync: {lastResult.synced} synced, {lastResult.failed} failed
            {lastResult.error ? ` — ${lastResult.error}` : ''}.
          </p>
        ) : null}
        {failedSyncEntries.length > 0 ? (
          <ul className="sync-error-list">
            {failedSyncEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.entity_type}</strong> {entry.entity_id.slice(0, 8)}… —{' '}
                {entry.last_error ?? 'Unknown error'} ({entry.attempts} attempts)
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="settings-section">
        <h3>Export</h3>
        <p className="hint">Downloads `mmap-backup-YYYY-MM-DD.json` with all local data.</p>
        <button
          type="button"
          className="button button--primary"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Exporting…' : 'Export Backup'}
        </button>
      </div>

      <div className="settings-section">
        <h3>Import</h3>
        <fieldset className="fieldset">
          <legend>Duplicate records (same UUID)</legend>
          <label className="choice">
            <input
              type="radio"
              name="duplicateStrategy"
              value="skip"
              checked={duplicateStrategy === 'skip'}
              onChange={() => setDuplicateStrategy('skip')}
            />
            <span>Skip duplicates</span>
          </label>
          <label className="choice">
            <input
              type="radio"
              name="duplicateStrategy"
              value="replace"
              checked={duplicateStrategy === 'replace'}
              onChange={() => setDuplicateStrategy('replace')}
            />
            <span>Replace duplicates</span>
          </label>
        </fieldset>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              handleImportFile(file).catch(() => undefined);
            }
          }}
        />

        <button
          type="button"
          className="button button--secondary"
          disabled={isImporting}
          onClick={() => fileInputRef.current?.click()}
        >
          {isImporting ? 'Importing…' : 'Choose Backup File'}
        </button>
      </div>

      {status ? <p className="status-message">{status}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
      {importResult && importResult.errors.length === 0 ? (
        <p className="hint">
          Imported {importResult.importedAssessments + importResult.replacedAssessments} assessments
          and {importResult.importedMeasurements + importResult.replacedMeasurements} measurements.
        </p>
      ) : null}

      <div className="settings-section">
        <h3>Field usability</h3>
        <label className="choice">
          <input
            type="checkbox"
            checked={gloveMode}
            onChange={(event) => {
              const enabled = event.target.checked;
              setGloveModeState(enabled);
              setGloveMode(enabled);
              applyGloveModeClass(enabled);
            }}
          />
          <span>Glove mode (larger touch targets and text)</span>
        </label>
      </div>

      <div className="settings-section">
        <h3>Developer: protocol for new assessments</h3>
        <p className="hint">
          Switch assessment type to verify schema-driven forms. Dolphin stub stays local-only and is
          not synced to the API.
        </p>
        <label className="field" htmlFor="dev-protocol">
          <span>Default protocol for new captures</span>
          <select
            id="dev-protocol"
            value={devProtocolKey}
            onChange={(event) => {
              const value = event.target.value;
              setDevProtocolKeyState(value);
              setDevProtocolKey(value || null);
            }}
          >
            <option value="">Manatee v1 (production default)</option>
            {listProtocolEntries().map((entry) => (
              <option key={protocolKeyToString(entry)} value={protocolKeyToString(entry)}>
                {entry.label}
                {!entry.syncable ? ' — local only' : ''}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="settings-section">
        <h3>Field feedback</h3>
        <p className="hint">
          Capture UAT notes offline. Export JSON and attach to GitHub issues after field sessions.
        </p>
        <form
          className="feedback-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!feedbackMessage.trim()) {
              return;
            }
            addFeedback(feedbackMessage, feedbackContext)
              .then(() => {
                setFeedbackMessage('');
                setFeedbackContext('');
                setStatus('Feedback saved locally.');
                return refreshSummary();
              })
              .catch(() => setError('Unable to save feedback.'));
          }}
        >
          <label className="field" htmlFor="feedback-message">
            <span>Feedback</span>
            <textarea
              id="feedback-message"
              rows={3}
              value={feedbackMessage}
              onChange={(event) => setFeedbackMessage(event.target.value)}
              required
            />
          </label>
          <label className="field" htmlFor="feedback-context">
            <span>Context (optional)</span>
            <input
              id="feedback-context"
              type="text"
              value={feedbackContext}
              onChange={(event) => setFeedbackContext(event.target.value)}
              placeholder="Scenario, screen, or assessment ID"
            />
          </label>
          <div className="settings-actions">
            <button type="submit" className="button button--secondary">
              Save Feedback
            </button>
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                exportFeedbackJson()
                  .then((payload) => {
                    const blob = new Blob([JSON.stringify(payload, null, 2)], {
                      type: 'application/json',
                    });
                    const url = URL.createObjectURL(blob);
                    const anchor = document.createElement('a');
                    anchor.href = url;
                    anchor.download = `mmap-feedback-${new Date().toISOString().slice(0, 10)}.json`;
                    anchor.click();
                    URL.revokeObjectURL(url);
                    setStatus('Feedback exported.');
                    return refreshSummary();
                  })
                  .catch(() => setError('Unable to export feedback.'));
              }}
            >
              Export Feedback JSON
            </button>
          </div>
        </form>
        {feedbackEntries.length > 0 ? (
          <ul className="feedback-list" aria-label="Saved feedback">
            {feedbackEntries.slice(0, 5).map((entry) => (
              <li key={entry.id}>
                <strong>{new Date(entry.created_at).toLocaleString()}</strong>
                <div>{entry.message}</div>
                {entry.context ? <div className="hint">{entry.context}</div> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export { clearAllData };
