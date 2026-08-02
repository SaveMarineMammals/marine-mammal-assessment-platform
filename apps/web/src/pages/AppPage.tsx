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
      <section className="cta-row">
        <a className="button button--primary" href={getFieldAppUrl()}>
          Open field app
        </a>
        <a className="button button--secondary" href="/docs/manatee-v1">
          Read field guide
        </a>
      </section>
      <MarkdownContent markdown={page.body} />
    </article>
  );
}
