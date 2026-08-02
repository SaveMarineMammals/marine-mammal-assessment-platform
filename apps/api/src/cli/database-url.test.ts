import { afterEach, describe, expect, it } from 'vitest';
import {
  DATABASE_URL_USAGE,
  normalizeDatabaseUrl,
  parseDatabaseUrlFromArgs,
  resolveDatabaseUrl,
} from './database-url.js';

describe('database-url CLI', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalDbHost = process.env.DB_HOST;
  const originalDbPort = process.env.DB_PORT;
  const originalDbName = process.env.DB_NAME;

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }

    if (originalDbHost === undefined) {
      delete process.env.DB_HOST;
    } else {
      process.env.DB_HOST = originalDbHost;
    }

    if (originalDbPort === undefined) {
      delete process.env.DB_PORT;
    } else {
      process.env.DB_PORT = originalDbPort;
    }

    if (originalDbName === undefined) {
      delete process.env.DB_NAME;
    } else {
      process.env.DB_NAME = originalDbName;
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

  it('normalizes RDS Secrets Manager JSON from the environment', () => {
    process.env.DATABASE_URL = JSON.stringify({
      username: 'mmap',
      password: 'p@ss:word',
      host: 'db.example.com',
      port: 5432,
      dbname: 'mmap',
    });
    expect(resolveDatabaseUrl(['node', 'migrate.ts'])).toBe(
      'postgresql://mmap:p%40ss%3Aword@db.example.com:5432/mmap?uselibpqcompat=true&sslmode=require',
    );
  });

  it('normalizes RDS JSON passed via --database-url', () => {
    const json = JSON.stringify({
      username: 'mmap',
      password: 'secret',
      host: 'localhost',
      port: 5432,
      dbname: 'mmap',
    });
    expect(parseDatabaseUrlFromArgs(['node', 'migrate.ts', '-d', json])).toBe(
      'postgresql://mmap:secret@localhost:5432/mmap?uselibpqcompat=true&sslmode=require',
    );
  });

  it('fills host/dbname/port from DB_* env when RDS JSON has only username/password', () => {
    process.env.DB_HOST = 'mmap-staging-postgres.example.rds.amazonaws.com';
    process.env.DB_PORT = '5432';
    process.env.DB_NAME = 'mmap';
    expect(
      normalizeDatabaseUrl(
        JSON.stringify({
          username: 'mmap',
          password: 'p@ss',
        }),
      ),
    ).toBe(
      'postgresql://mmap:p%40ss@mmap-staging-postgres.example.rds.amazonaws.com:5432/mmap?uselibpqcompat=true&sslmode=require',
    );
  });

  it('throws when username/password JSON lacks DB_HOST/DB_NAME', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_NAME;
    expect(() =>
      normalizeDatabaseUrl(
        JSON.stringify({
          username: 'mmap',
          password: 'secret',
        }),
      ),
    ).toThrow(/missing required RDS secret fields/);
  });
});
