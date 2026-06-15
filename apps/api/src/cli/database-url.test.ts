import { afterEach, describe, expect, it } from 'vitest';
import {
  DATABASE_URL_USAGE,
  parseDatabaseUrlFromArgs,
  resolveDatabaseUrl,
} from './database-url.js';

describe('database-url CLI', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('parses --database-url with a separate value', () => {
    expect(parseDatabaseUrlFromArgs(['node', 'migrate.ts', '--database-url', 'postgres://a'])).toBe(
      'postgres://a',
    );
  });

  it('parses --database-url= inline form', () => {
    expect(parseDatabaseUrlFromArgs(['node', 'migrate.ts', '--database-url=postgres://b'])).toBe(
      'postgres://b',
    );
  });

  it('parses -d shorthand', () => {
    expect(parseDatabaseUrlFromArgs(['node', 'migrate.ts', '-d', 'postgres://c'])).toBe(
      'postgres://c',
    );
  });

  it('sets process.env.DATABASE_URL from argv', () => {
    delete process.env.DATABASE_URL;
    expect(resolveDatabaseUrl(['node', 'migrate.ts', '-d', 'postgres://from-cli'])).toBe(
      'postgres://from-cli',
    );
    expect(process.env.DATABASE_URL).toBe('postgres://from-cli');
  });

  it('falls back to the existing environment variable', () => {
    process.env.DATABASE_URL = 'postgres://from-env';
    expect(resolveDatabaseUrl(['node', 'migrate.ts'])).toBe('postgres://from-env');
  });

  it('throws when no URL is available', () => {
    delete process.env.DATABASE_URL;
    expect(() => resolveDatabaseUrl(['node', 'migrate.ts'])).toThrow(DATABASE_URL_USAGE);
  });
});
