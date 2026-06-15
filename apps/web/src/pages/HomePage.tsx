import { Link } from 'react-router-dom';
import { MarkdownContent } from '../components/MarkdownContent.js';
import { getFieldAppUrl } from '../lib/config.js';
import { getContentPage } from '../lib/content.js';

export function HomePage() {
  const page = getContentPage('home');

  return (
    <article className="page hero">
      <header className="page-header">
        <p className="eyebrow">Open source · Open data · Offline-first</p>
        <h1>{page.title}</h1>
        {page.description ? <p className="lede">{page.description}</p> : null}
      </header>
      <section className="cta-row">
        <Link className="button button--primary" to="/app">
          Get the field app
        </Link>
        <Link className="button button--secondary" to="/dataset">
          Browse dataset
        </Link>
        <a className="button button--ghost" href={getFieldAppUrl()}>
          Open field PWA
        </a>
      </section>
      <MarkdownContent markdown={page.body} />
    </article>
  );
}
