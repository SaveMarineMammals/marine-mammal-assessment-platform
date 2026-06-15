import { useLocation } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { usePageNavigation } from '../components/navigation/usePageNavigation.js';
import { getManateeFieldGuide } from '../lib/protocol-guide.js';

interface HelpLocationState {
  from?: string;
}

export function ProtocolGuidePage() {
  const location = useLocation();
  const from = (location.state as HelpLocationState | null)?.from ?? '/';
  const page = getManateeFieldGuide();

  usePageNavigation({
    title: 'Help & Protocol',
    showBack: true,
    backTo: from,
  });

  return (
    <article className="panel protocol-guide">
      <header className="page-header">
        <h2>{page.title}</h2>
        {page.description ? <p className="hint">{page.description}</p> : null}
      </header>
      <MarkdownContent markdown={page.body} />
    </article>
  );
}
