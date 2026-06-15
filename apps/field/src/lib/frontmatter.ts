export interface FrontmatterData {
  title?: string;
  description?: string;
}

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseFrontmatter(raw: string): { data: FrontmatterData; content: string } {
  const text = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
  const match = FRONTMATTER_PATTERN.exec(text);

  if (!match) {
    return { data: {}, content: text.trim() };
  }

  const data: FrontmatterData = {};

  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();

    if (key === 'title') {
      data.title = value;
    } else if (key === 'description') {
      data.description = value;
    }
  }

  return { data, content: match[2].trim() };
}
