const SKIP_WAITING = { type: 'SKIP_WAITING' };

function waitForControllerChange(timeoutMs: number): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return Promise.resolve(false);
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(false);
    }, timeoutMs);

    const onChange = () => {
      window.clearTimeout(timeout);
      navigator.serviceWorker.removeEventListener('controllerchange', onChange);
      resolve(true);
    };

    navigator.serviceWorker.addEventListener('controllerchange', onChange);
  });
}

function waitForInstalledWorker(
  registration: ServiceWorkerRegistration,
  worker: ServiceWorker,
  timeoutMs: number,
): Promise<ServiceWorker | null> {
  if (registration.waiting) {
    return Promise.resolve(registration.waiting);
  }

  if (worker.state === 'installed' && navigator.serviceWorker.controller) {
    return Promise.resolve(registration.waiting ?? worker);
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      worker.removeEventListener('statechange', onStateChange);
      resolve(registration.waiting ?? null);
    }, timeoutMs);

    const onStateChange = () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) {
        window.clearTimeout(timeout);
        worker.removeEventListener('statechange', onStateChange);
        resolve(registration.waiting ?? worker);
      }
    };

    worker.addEventListener('statechange', onStateChange);
  });
}

function waitForWaitingWorker(
  registration: ServiceWorkerRegistration,
  timeoutMs: number,
): Promise<ServiceWorker | null> {
  if (registration.waiting) {
    return Promise.resolve(registration.waiting);
  }

  if (registration.installing) {
    return waitForInstalledWorker(registration, registration.installing, timeoutMs);
  }

  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => {
      registration.removeEventListener('updatefound', onUpdateFound);
      resolve(registration.waiting ?? null);
    }, timeoutMs);

    const onUpdateFound = () => {
      const worker = registration.installing ?? registration.waiting;
      if (!worker) {
        return;
      }

      void waitForInstalledWorker(registration, worker, timeoutMs).then((result) => {
        window.clearTimeout(timeout);
        registration.removeEventListener('updatefound', onUpdateFound);
        resolve(result);
      });
    };

    registration.addEventListener('updatefound', onUpdateFound);
  });
}

async function getRegistration(): Promise<ServiceWorkerRegistration | undefined> {
  if (!('serviceWorker' in navigator)) {
    return undefined;
  }
  return (await navigator.serviceWorker.getRegistration()) ?? undefined;
}

async function activateWaitingWorker(worker: ServiceWorker): Promise<void> {
  worker.postMessage(SKIP_WAITING);
  await waitForControllerChange(5000);
}

/**
 * Activate a waiting service worker when available, otherwise force a fresh reload.
 */
export async function applyAppUpdate(messageSkipWaiting?: () => void): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    window.location.reload();
    return;
  }

  let registration = await getRegistration();
  if (registration) {
    await registration.update().catch(() => undefined);
  }

  registration = (await getRegistration()) ?? registration;
  const waiting =
    registration?.waiting ?? (registration ? await waitForWaitingWorker(registration, 8000) : null);

  if (waiting) {
    messageSkipWaiting?.();
    await activateWaitingWorker(waiting);
    window.location.reload();
    return;
  }

  if (registration) {
    await registration.unregister().catch(() => undefined);
  }

  const url = new URL(window.location.href);
  url.searchParams.set('_appUpdate', String(Date.now()));
  window.location.replace(url.toString());
}
