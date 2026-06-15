import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { HelpLink } from '../HelpLink.js';
import { useOnlineStatus } from '../../hooks/useOnlineStatus.js';
import { useNavigationContext } from './NavigationContext.js';
import { NAV_ITEMS, getDefaultPageTitle } from './nav-config.js';
import { useSyncNavBadge } from './useSyncNavBadge.js';

export function AppLandscapeNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const badgeCount = useSyncNavBadge();
  const { pageNav } = useNavigationContext();

  const showBack =
    pageNav.showBack ?? (pathname.startsWith('/assessments/') && pathname !== '/assessments/new');
  const backTo = pageNav.backTo ?? '/';
  const contextTitle = pageNav.title ?? getDefaultPageTitle(pathname);

  return (
    <header className="app-landscape-nav" aria-label="Application header">
      <div className="app-landscape-nav__brand">
        {showBack ? (
          <button
            type="button"
            className="app-landscape-nav__back button button--ghost"
            onClick={() => navigate(backTo)}
          >
            ← Back
          </button>
        ) : null}
        <div>
          <p className="app-landscape-nav__eyebrow">MMAP Field</p>
          <p className="app-landscape-nav__context">{contextTitle}</p>
        </div>
      </div>

      <nav className="app-landscape-nav__tabs" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.id}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `app-landscape-nav__tab${isActive ? ' app-landscape-nav__tab--active' : ''}`
            }
          >
            {item.label}
            {item.id === 'sync' && badgeCount > 0 ? (
              <span className="app-landscape-nav__badge" aria-label={`${badgeCount} sync items`}>
                {badgeCount}
              </span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <div className="app-landscape-nav__utilities">
        <Link
          to="/sync"
          className={`status-pill ${online ? 'status-pill--online' : 'status-pill--offline'}`}
          aria-label={online ? 'Online — open sync' : 'Offline — open sync'}
        >
          {online ? 'Online' : 'Offline'}
        </Link>
        <HelpLink from={pathname} className="app-landscape-nav__help" />
      </div>
    </header>
  );
}
