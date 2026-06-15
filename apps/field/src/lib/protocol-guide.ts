import guideRaw from '../../../../docs/protocols/manatee-v1-field-guide.md?raw';
import { parseFrontmatter } from './frontmatter.js';

export interface ProtocolGuideDocument {
  title: string;
  description?: string;
  body: string;
}

export function getManateeFieldGuide(): ProtocolGuideDocument {
  const { data, content } = parseFrontmatter(guideRaw);
  return {
    title: data.title ?? 'Manatee v1 Field Guide',
    description: data.description,
    body: content,
  };
}
