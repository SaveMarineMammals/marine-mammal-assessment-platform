import { APP_VERSION } from '../lib/version.js';

export function AppFooter() {
  return (
    <footer className="app-footer">
      <p>
        MMAP Field · <span className="app-footer__version">{APP_VERSION}</span>
      </p>
    </footer>
  );
}
