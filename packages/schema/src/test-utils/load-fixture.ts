import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '../../fixtures');

export function loadFixture<T = unknown>(filename: string): T {
  const contents = readFileSync(join(fixturesDir, filename), 'utf8');
  return JSON.parse(contents) as T;
}
