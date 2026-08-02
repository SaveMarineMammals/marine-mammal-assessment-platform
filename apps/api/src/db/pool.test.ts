import { describe, expect, it } from 'vitest';
import { buildPoolConfig } from './pool.js';

describe('buildPoolConfig', () => {
  it('enables TLS without CA verification for RDS sslmode=require URLs', () => {
    const config = buildPoolConfig(
      'postgresql://mmap:secret@db.example.rds.amazonaws.com:5432/mmap?uselibpqcompat=true&sslmode=require',
    );
    expect(config.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('leaves local plain URLs without ssl options', () => {
    const config = buildPoolConfig('postgresql://mmap:mmap@localhost:5432/mmap');
    expect(config.ssl).toBeUndefined();
  });
});
