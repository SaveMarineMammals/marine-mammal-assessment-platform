import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { HelpLink } from '../HelpLink.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { useNavigationContext } from './NavigationContext.js';
import { NAV_ITEMS, getDefaultPageTitle } from './nav-config.js';
import { useSyncNavBadge } from './useSyncNavBadge.js';

export function AppTopBar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { pageNav } = useNavigationContext();

  const title = pageNav.title ?? getDefaultPageTitle(pathname);
  const showBack =
    pageNav.showBack ?? (pathname.startsWith('/assessments/') && pathname !== '/assessments/new');
  const backTo = pageNav.backTo ?? '/';

  return (
    <header className="app-top-bar" aria-label="Page header">
      <div className="app-top-bar__start">
        {showBack ? (
          <button
            type="button"
            className="app-top-bar__back button button--ghost"
            onClick={() => navigate(backTo)}
          >
            ← Back
          </button>
        ) : null}
        <h1 className="app-top-bar__title">{title}</h1>
      </div>
      <div className="app-top-bar__end">
        <HelpLink from={pathname} className="app-top-bar__help" />
        <Link
          to="/sync"
          className="app-top-bar__connectivity connectivity-indicator"
          aria-label={online ? 'Online — open sync' : 'Offline — open sync'}
        >
          <span
            className={`connectivity-indicator__dot ${online ? 'connectivity-indicator__dot--online' : 'connectivity-indicator__dot--offline'}`}
          />
          <span className="connectivity-indicator__label">{online ? 'Online' : 'Offline'}</span>
        </Link>
      </div>
    </header>
  );
}

export function AppBottomNav() {
  const badgeCount = useSyncNavBadge();

  return (
    <nav className="app-bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.id}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            `app-bottom-nav__item${isActive ? ' app-bottom-nav__item--active' : ''}`
          }
        >
          <span className="app-bottom-nav__label">{item.shortLabel}</span>
          {item.id === 'sync' && badgeCount > 0 ? (
            <span className="app-bottom-nav__badge" aria-label={`${badgeCount} sync items`}>
              {badgeCount}
            </span>
          ) : null}
        </NavLink>
      ))}
    </nav>
  );
}
