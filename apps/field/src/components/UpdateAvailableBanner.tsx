import { useAppUpdate } from '../pwa/AppUpdateProvider.js';

export function UpdateAvailableBanner() {
  const {
    updateAvailable,
    currentVersion,
    pendingVersion,
    isApplyingUpdate,
    applyUpdate,
    dismissUpdate,
  } = useAppUpdate();

  if (!updateAvailable) {
    return null;
  }

  return (
    <section className="update-banner" role="status" aria-live="polite">
      <p className="update-banner__message">
        A new version of MMAP Field is available
        {pendingVersion ? (
          <>
            {' '}
            (<span className="update-banner__version">{pendingVersion}</span>)
          </>
        ) : null}
        . You are running <span className="update-banner__version">{currentVersion}</span>.
      </p>
      <div className="update-banner__actions">
        <button
          type="button"
          className="button button--primary"
          disabled={isApplyingUpdate}
          onClick={() => {
            applyUpdate().catch(() => undefined);
          }}
        >
          {isApplyingUpdate ? 'Updating…' : 'Update now'}
        </button>
        <button
          type="button"
          className="button button--ghost"
          disabled={isApplyingUpdate}
          onClick={() => dismissUpdate()}
        >
          Later
        </button>
      </div>
    </section>
  );
}
