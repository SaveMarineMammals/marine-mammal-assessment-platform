import { Link, NavLink } from 'react-router-dom';
import { getFieldAppUrl, getGithubUrl } from '../lib/config.js';

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
            <a className="site-nav__launch" href={getFieldAppUrl()}>
              Field app
            </a>
            <NavLink to="/app">Get started</NavLink>
            <NavLink to="/docs">Guides</NavLink>
            <NavLink to="/dataset">Dataset</NavLink>
          </nav>
        </div>
      </header>
      <main id="main-content" className="site-main">
        {children}
      </main>
      <footer className="site-footer">
        <div className="site-footer__inner">
          <p>
            Built for conservation field teams · Open data under CC BY 4.0 · Software under Apache
            2.0
          </p>
          <p>
            <Link to="/docs">Guides</Link> · <Link to="/dataset">Dataset</Link> ·{' '}
            <a href={getFieldAppUrl()}>Field app</a> ·{' '}
            <a href={getGithubUrl()} target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
