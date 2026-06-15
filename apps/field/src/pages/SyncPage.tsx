import { useEffect, useState } from 'react';
import { getApiBaseUrlDisplay } from '../config.js';
import { usePageNavigation } from '../components/navigation/usePageNavigation.js';
import { useNavigationRefresh } from '../context/NavigationRefreshContext.js';
import type { SyncQueueEntry } from '../db/types.js';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { usePendingSyncCount, useSyncErrorCount } from '../hooks/usePendingSyncCount.js';
import { useSync } from '../hooks/useSync.js';
import { listFailedSyncEntries } from '../sync/sync-service.js';

export function SyncPage() {
  usePageNavigation({ title: 'Sync' });

  const { refreshKey, bumpRefresh } = useNavigationRefresh();
  const online = useOnlineStatus();
  const pendingSyncCount = usePendingSyncCount(refreshKey);
  const syncErrorCount = useSyncErrorCount(refreshKey);
  const { isSyncing, syncNow, retryFailed, lastResult } = useSync(refreshKey);
  const [failedSyncEntries, setFailedSyncEntries] = useState<SyncQueueEntry[]>([]);

  useEffect(() => {
    listFailedSyncEntries()
      .then(setFailedSyncEntries)
      .catch(() => setFailedSyncEntries([]));
  }, [refreshKey, lastResult]);

  return (
    <section className="panel sync-page">
      <header className="panel__header">
        <h2>Sync status</h2>
      </header>

      <dl className="detail-grid storage-summary">
        <div>
          <dt>Connection</dt>
          <dd>{online ? 'Online' : 'Offline'}</dd>
        </div>
        <div>
          <dt>Pending upload</dt>
          <dd>{pendingSyncCount}</dd>
        </div>
        <div>
          <dt>Sync errors</dt>
          <dd>{syncErrorCount}</dd>
        </div>
        <div>
          <dt>API endpoint</dt>
          <dd>
            <code>{getApiBaseUrlDisplay()}</code>
          </dd>
        </div>
      </dl>

      <p className="hint">
        Sync runs automatically when online, every minute, and when connectivity returns.
      </p>

      <div className="settings-actions">
        <button
          type="button"
          className="button button--primary"
          disabled={!online || isSyncing}
          onClick={() => {
            syncNow()
              .then(() => bumpRefresh())
              .catch(() => undefined);
          }}
        >
          {isSyncing ? 'Syncing…' : 'Sync Now'}
        </button>
        {failedSyncEntries.length > 0 ? (
          <button
            type="button"
            className="button button--secondary"
            disabled={!online || isSyncing}
            onClick={() => {
              retryFailed()
                .then(() => bumpRefresh())
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
    </section>
  );
}
