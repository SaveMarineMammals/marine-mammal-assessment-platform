import { useCallback, useEffect, useState } from 'react';

import { Routes, Route, useNavigate, useParams } from 'react-router-dom';

import { AssessmentDetail } from './components/AssessmentDetail.js';

import { AssessmentList } from './components/AssessmentList.js';

import { CreateAssessmentForm } from './components/CreateAssessmentForm.js';

import { SettingsPage } from './components/SettingsPage.js';

import { AppShell } from './components/navigation/AppShell.js';

import { usePageNavigation } from './components/navigation/usePageNavigation.js';

import {
  NavigationRefreshProvider,
  useNavigationRefresh,
} from './context/NavigationRefreshContext.js';

import { getAssessmentWithMeasurements, listAssessments } from './data/repository.js';

import type { StoredAssessment } from './db/types.js';

import type { AssessmentWithMeasurements } from './db/types.js';

import { useSyncRefresh } from './hooks/useSyncRefresh.js';

import { useOrientationLayout } from './hooks/useOrientationLayout.js';

import { UpdateAvailableBanner } from './components/UpdateAvailableBanner.js';

import { SyncPage } from './pages/SyncPage.js';
import { ProtocolGuidePage } from './pages/ProtocolGuidePage.js';

function AssessmentListPage() {
  const navigate = useNavigate();

  const layout = useOrientationLayout();

  const { bumpRefresh } = useNavigationRefresh();

  const [assessments, setAssessments] = useState<StoredAssessment[]>([]);

  const [loading, setLoading] = useState(true);

  usePageNavigation({ title: 'Assessments' });

  const reloadAssessments = useCallback(async () => {
    const records = await listAssessments();

    setAssessments(records);

    bumpRefresh();
  }, [bumpRefresh]);

  const loadAssessments = useCallback(async () => {
    setLoading(true);

    await reloadAssessments();

    setLoading(false);
  }, [reloadAssessments]);

  useEffect(() => {
    loadAssessments().catch(() => setLoading(false));
  }, [loadAssessments]);

  useSyncRefresh(reloadAssessments);

  return loading ? (
    <p className="empty-state">Loading local assessments…</p>
  ) : (
    <AssessmentList
      assessments={assessments}
      showCreateButton={layout === 'landscape'}
      onSelect={(id) => navigate(`/assessments/${id}`)}
      onCreate={() => navigate('/assessments/new')}
    />
  );
}

function CreateAssessmentPage() {
  const navigate = useNavigate();

  const { bumpRefresh } = useNavigationRefresh();

  usePageNavigation({ title: 'New Assessment', showBack: true, backTo: '/' });

  return (
    <CreateAssessmentForm
      onCreated={(id) => {
        bumpRefresh();

        navigate(`/assessments/${id}`);
      }}
      onCancel={() => navigate('/')}
    />
  );
}

function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const navigate = useNavigate();

  const layout = useOrientationLayout();

  const { bumpRefresh } = useNavigationRefresh();

  const [data, setData] = useState<AssessmentWithMeasurements | undefined>();

  const [loading, setLoading] = useState(true);

  usePageNavigation({
    title: data?.assessment.name ?? 'Assessment',

    showBack: true,

    backTo: '/',
  });

  const reloadAssessment = useCallback(async () => {
    if (!id) {
      return;
    }

    const result = await getAssessmentWithMeasurements(id);

    setData(result);

    bumpRefresh();
  }, [bumpRefresh, id]);

  const loadAssessment = useCallback(async () => {
    if (!id) {
      return;
    }

    setLoading(true);

    await reloadAssessment();

    setLoading(false);
  }, [id, reloadAssessment]);

  useEffect(() => {
    loadAssessment().catch(() => setLoading(false));
  }, [loadAssessment]);

  useSyncRefresh(reloadAssessment);

  if (loading) {
    return <p className="empty-state">Loading assessment…</p>;
  }

  if (!data) {
    return (
      <section className="panel">
        <p className="empty-state">Assessment not found.</p>

        <button type="button" className="button button--secondary" onClick={() => navigate('/')}>
          Back to list
        </button>
      </section>
    );
  }

  return (
    <AssessmentDetail
      className={layout === 'portrait' ? 'assessment-detail--nav-back' : undefined}
      data={data}
      onBack={() => navigate('/')}
      onUpdated={loadAssessment}
    />
  );
}

function SettingsRoutePage() {
  usePageNavigation({ title: 'Settings' });

  const { bumpRefresh } = useNavigationRefresh();

  return <SettingsPage onChanged={bumpRefresh} />;
}

export function App() {
  return (
    <div className="app-shell">
      <UpdateAvailableBanner />

      <NavigationRefreshProvider>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<AssessmentListPage />} />

            <Route path="/assessments/new" element={<CreateAssessmentPage />} />

            <Route path="/assessments/:id" element={<AssessmentDetailPage />} />

            <Route path="/sync" element={<SyncPage />} />

            <Route path="/help/protocol" element={<ProtocolGuidePage />} />

            <Route path="/settings" element={<SettingsRoutePage />} />
          </Route>
        </Routes>
      </NavigationRefreshProvider>
    </div>
  );
}
