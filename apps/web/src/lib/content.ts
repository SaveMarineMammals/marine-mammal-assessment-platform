import { parseFrontmatter } from './frontmatter.js';

export interface MarkdownDocument {
  title: string;
  description?: string;
  body: string;
}

const markdownModules = import.meta.glob('../../content/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const protocolGuide = import.meta.glob('../../../docs/protocols/manatee-v1-field-guide.md', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

function parseMarkdown(raw: string): MarkdownDocument {
  const { data, content } = parseFrontmatter(raw);
  return {
    title: data.title ?? 'MMAP',
    description: data.description,
    body: content,
  };
}

export function getContentPage(slug: 'home' | 'app' | 'docs'): MarkdownDocument {
  const key = Object.keys(markdownModules).find((path) => path.endsWith(`/${slug}.md`));
  if (!key) {
    throw new Error(`Missing content page: ${slug}`);
  }
  return parseMarkdown(markdownModules[key]);
}

export function getManateeFieldGuide(): MarkdownDocument {
  const key = Object.keys(protocolGuide)[0];
  if (!key) {
    throw new Error('Missing manatee field guide');
  }
  return parseMarkdown(protocolGuide[key]);
}
