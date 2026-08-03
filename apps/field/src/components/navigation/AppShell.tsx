import { Outlet } from 'react-router-dom';
import { useViewportLayout } from '../../hooks/useViewportLayout.js';
import { AppFooter } from '../AppFooter.js';
import { AppLandscapeNav } from './AppLandscapeNav.js';
import { AppBottomNav, AppTopBar } from './AppTopBar.js';
import { NavigationProvider } from './NavigationContext.js';

export function AppShell() {
  const { shell } = useViewportLayout();

  return (
    <NavigationProvider>
      <div className={`app-shell__body app-shell__body--${shell}`}>
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
