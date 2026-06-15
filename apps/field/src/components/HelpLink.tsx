import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

interface HelpLinkProps {
  from: string;
  className?: string;
}

function HelpIcon(): ReactNode {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M9.75 9.75a2.25 2.25 0 1 1 3.55 1.8c-.9.7-1.3 1.2-1.3 2.45"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16.75" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function HelpLink({ from, className }: HelpLinkProps) {
  return (
    <Link
      to="/help/protocol"
      state={{ from }}
      className={['help-link', className].filter(Boolean).join(' ')}
      aria-label="Help and protocol guide"
      title="Help and protocol guide"
    >
      <HelpIcon />
    </Link>
  );
}
