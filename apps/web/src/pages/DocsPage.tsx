import { Link } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { getFieldAppUrl, getOpenApiUrl } from '../lib/config.js';
import { getContentPage } from '../lib/content.js';

export function DocsPage() {
  const page = getContentPage('docs');

  return (
    <article className="page">
      <header className="page-header">
        <h1>{page.title}</h1>
        {page.description ? <p className="lede">{page.description}</p> : null}
      </header>
      <MarkdownContent markdown={page.body} />
      <section className="panel">
        <h2>Quick links</h2>
        <ul className="link-list">
          <li>
            <Link to="/docs/manatee-v1">Manatee field guide</Link>
          </li>
          <li>
            <a href={getFieldAppUrl()}>Open field app</a>
          </li>
          <li>
            <Link to="/app">Install on a tablet</Link>
          </li>
          <li>
            <a href={getOpenApiUrl()} target="_blank" rel="noreferrer">
              Technical API reference
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}
