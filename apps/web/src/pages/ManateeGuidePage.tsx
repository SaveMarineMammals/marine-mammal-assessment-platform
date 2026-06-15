import { MarkdownContent } from '../components/MarkdownContent.js';
import { getManateeFieldGuide } from '../lib/content.js';

export function ManateeGuidePage() {
  const page = getManateeFieldGuide();

  return (
    <article className="page">
      <header className="page-header">
        <h1>{page.title}</h1>
        {page.description ? <p className="lede">{page.description}</p> : null}
      </header>
      <MarkdownContent markdown={page.body} />
    </article>
  );
}
