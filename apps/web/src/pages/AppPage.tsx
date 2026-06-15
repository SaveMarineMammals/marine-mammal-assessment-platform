import { MarkdownContent } from '../components/MarkdownContent.js';
import { getFieldAppUrl } from '../lib/config.js';
import { getContentPage } from '../lib/content.js';

export function AppPage() {
  const page = getContentPage('app');

  return (
    <article className="page">
      <header className="page-header">
        <h1>{page.title}</h1>
        {page.description ? <p className="lede">{page.description}</p> : null}
      </header>
      <p>
        Current field app URL: <a href={getFieldAppUrl()}>{getFieldAppUrl()}</a>
      </p>
      <MarkdownContent markdown={page.body} />
    </article>
  );
}
