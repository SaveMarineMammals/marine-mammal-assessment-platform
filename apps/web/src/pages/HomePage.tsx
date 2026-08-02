import { Link } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { getFieldAppUrl } from '../lib/config.js';
import { getContentPage } from '../lib/content.js';

export function HomePage() {
  const page = getContentPage('home');

  return (
    <article className="page hero">
      <header className="page-header">
        <p className="eyebrow">For field teams · Open data · Works offline</p>
        <h1>{page.title}</h1>
        {page.description ? <p className="lede">{page.description}</p> : null}
      </header>
      <section className="cta-row">
        <a className="button button--primary" href={getFieldAppUrl()}>
          Open field app
        </a>
        <Link className="button button--secondary" to="/app">
          How to install
        </Link>
        <Link className="button button--ghost" to="/dataset">
          Browse dataset
        </Link>
      </section>
      <MarkdownContent markdown={page.body} />
    </article>
  );
}
