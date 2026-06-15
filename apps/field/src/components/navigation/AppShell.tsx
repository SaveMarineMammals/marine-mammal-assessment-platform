import { Outlet } from 'react-router-dom';
import { useOrientationLayout } from '../../hooks/useOrientationLayout.js';
import { AppFooter } from '../AppFooter.js';
import { AppLandscapeNav } from './AppLandscapeNav.js';
import { AppBottomNav, AppTopBar } from './AppTopBar.js';
import { NavigationProvider } from './NavigationContext.js';

export function AppShell() {
  const layout = useOrientationLayout();

  return (
    <NavigationProvider>
      <div className={`app-shell__body app-shell__body--${layout}`}>
        <AppTopBar />
        <AppLandscapeNav />
        <main className="app-main">
          <Outlet />
        </main>
        <AppBottomNav />
        <AppFooter />
      </div>
    </NavigationProvider>
  );
}
