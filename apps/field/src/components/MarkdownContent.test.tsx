import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { MarkdownContent } from './MarkdownContent.js';

describe('MarkdownContent', () => {
  it('wraps GFM tables so wide content can scroll locally', () => {
    const markdown = [
      '| Measurement | Notes |',
      '| ----------- | ----- |',
      '| Heart rate  | Early |',
    ].join('\n');

    const html = renderToStaticMarkup(<MarkdownContent markdown={markdown} />);
    expect(html).toContain('class="table-wrap"');
    expect(html).toContain('<table>');
    expect(html).toContain('Heart rate');
  });
});
