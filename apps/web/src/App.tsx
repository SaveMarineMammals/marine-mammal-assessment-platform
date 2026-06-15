import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout.js';
import { AppPage } from './pages/AppPage.js';
import { DatasetPage } from './pages/DatasetPage.js';
import { DocsPage } from './pages/DocsPage.js';
import { HomePage } from './pages/HomePage.js';
import { ManateeGuidePage } from './pages/ManateeGuidePage.js';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/app" element={<AppPage />} />
        <Route path="/docs" element={<DocsPage />} />
        <Route path="/docs/manatee-v1" element={<ManateeGuidePage />} />
        <Route path="/dataset" element={<DatasetPage />} />
        <Route path="/github" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
