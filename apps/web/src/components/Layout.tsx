import { Link, NavLink } from 'react-router-dom';
import { getGithubUrl } from '../lib/config.js';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="site">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="site-header__inner">
          <Link to="/" className="brand">
            <span className="brand__eyebrow">MMAP</span>
            <span className="brand__title">Marine Mammal Assessment Platform</span>
          </Link>
          <nav className="site-nav" aria-label="Primary">
            <NavLink to="/">Home</NavLink>
            <NavLink to="/app">Field App</NavLink>
            <NavLink to="/docs">Docs</NavLink>
            <NavLink to="/dataset">Dataset</NavLink>
            <a href={getGithubUrl()} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </nav>
        </div>
      </header>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>
            Open source under Apache 2.0 · Dataset licensed CC BY 4.0 · Built for conservation
            research
          </p>
          <p>
            <Link to="/docs">Documentation</Link> · <Link to="/dataset">Dataset</Link> ·{' '}
            <a href={getGithubUrl()}>Contribute on GitHub</a>
          </p>
        </div>
      </footer>
    </div>
  );
}
