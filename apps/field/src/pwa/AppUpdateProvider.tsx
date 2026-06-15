import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { registerSW } from 'virtual:pwa-register';
import { applyAppUpdate } from './apply-app-update.js';
import { APP_VERSION } from '../lib/version.js';
import { fetchDeployVersion, isRemoteVersionNewer } from '../lib/version-check.js';

const VERSION_POLL_MS = 5 * 60 * 1000;
const SW_UPDATE_CHECK_MS = 60 * 60 * 1000;
const SERVICE_WORKER_UPDATE_TOKEN = 'service-worker';

interface AppUpdateContextValue {
  updateAvailable: boolean;
  currentVersion: string;
  pendingVersion: string | null;
  isApplyingUpdate: boolean;
  applyUpdate: () => Promise<void>;
  dismissUpdate: () => void;
}

const AppUpdateContext = createContext<AppUpdateContextValue | null>(null);

export function AppUpdateProvider({ children }: { children: ReactNode }) {
  const [serviceWorkerUpdateReady, setServiceWorkerUpdateReady] = useState(false);
  const [remoteVersion, setRemoteVersion] = useState<string | null>(null);
  const [dismissedTarget, setDismissedTarget] = useState<string | null>(null);
  const skipWaitingRef = useRef<(() => void) | undefined>(undefined);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const [isApplyingUpdate, setIsApplyingUpdate] = useState(false);

  const pendingVersion =
    remoteVersion && isRemoteVersionNewer(APP_VERSION, remoteVersion) ? remoteVersion : null;

  const updateTarget =
    pendingVersion ?? (serviceWorkerUpdateReady ? SERVICE_WORKER_UPDATE_TOKEN : null);

  const updateAvailable = Boolean(updateTarget) && updateTarget !== dismissedTarget;

  const checkRemoteVersion = useCallback(async () => {
    if (!navigator.onLine) {
      return;
    }

    const deployedVersion = await fetchDeployVersion();
    if (deployedVersion) {
      setRemoteVersion(deployedVersion);
    }
  }, []);

  const requestServiceWorkerUpdate = useCallback(() => {
    registrationRef.current?.update().catch(() => undefined);
  }, []);

  useEffect(() => {
    const updateServiceWorker = registerSW({
      immediate: true,
      onNeedRefresh() {
        setServiceWorkerUpdateReady(true);
        checkRemoteVersion().catch(() => undefined);
      },
      onRegisteredSW(_scriptUrl, registration) {
        registrationRef.current = registration;
      },
    });

    skipWaitingRef.current = () => {
      void updateServiceWorker(false);
    };
  }, [checkRemoteVersion]);

  useEffect(() => {
    checkRemoteVersion().catch(() => undefined);

    const pollId = window.setInterval(() => {
      checkRemoteVersion().catch(() => undefined);
      requestServiceWorkerUpdate();
    }, VERSION_POLL_MS);

    const swCheckId = window.setInterval(() => {
      requestServiceWorkerUpdate();
    }, SW_UPDATE_CHECK_MS);

    const handleResume = () => {
      checkRemoteVersion().catch(() => undefined);
      requestServiceWorkerUpdate();
    };

    window.addEventListener('focus', handleResume);
    window.addEventListener('online', handleResume);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        handleResume();
      }
    });

    return () => {
      window.clearInterval(pollId);
      window.clearInterval(swCheckId);
      window.removeEventListener('focus', handleResume);
      window.removeEventListener('online', handleResume);
    };
  }, [checkRemoteVersion, requestServiceWorkerUpdate]);

  const applyUpdate = useCallback(async () => {
    if (isApplyingUpdate) {
      return;
    }

    setIsApplyingUpdate(true);
    try {
      await applyAppUpdate(skipWaitingRef.current);
    } catch {
      window.location.reload();
    }
  }, [isApplyingUpdate]);

  const dismissUpdate = useCallback(() => {
    if (updateTarget) {
      setDismissedTarget(updateTarget);
    }
    setServiceWorkerUpdateReady(false);
  }, [updateTarget]);

  const value = useMemo<AppUpdateContextValue>(
    () => ({
      updateAvailable,
      currentVersion: APP_VERSION,
      pendingVersion,
      isApplyingUpdate,
      applyUpdate,
      dismissUpdate,
    }),
    [applyUpdate, dismissUpdate, isApplyingUpdate, pendingVersion, updateAvailable],
  );

  return <AppUpdateContext.Provider value={value}>{children}</AppUpdateContext.Provider>;
}

export function useAppUpdate(): AppUpdateContextValue {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within AppUpdateProvider');
  }
  return context;
}
