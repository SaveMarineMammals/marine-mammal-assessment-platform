import { Link } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { getOpenApiUrl } from '../lib/config.js';
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
            <Link to="/docs/manatee-v1">Manatee v1 field guide</Link>
          </li>
          <li>
            <a href={getOpenApiUrl()} target="_blank" rel="noreferrer">
              API OpenAPI docs
            </a>
          </li>
        </ul>
      </section>
    </article>
  );
}
