import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { applyGloveModeClass, getGloveMode } from './lib/preferences.js';
import { AppUpdateProvider } from './pwa/AppUpdateProvider.js';
import { startSyncWorker } from './sync/sync-worker.js';
import './index.css';

/** Vite BASE_URL always ends with `/`; React Router basename must not. */
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, '') || undefined;

function Root() {
  useEffect(() => {
    applyGloveModeClass(getGloveMode());
    startSyncWorker();
  }, []);

  return (
    <AppUpdateProvider>
      <BrowserRouter basename={routerBasename}>
        <App />
      </BrowserRouter>
    </AppUpdateProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
