import { describe, expect, it, vi } from 'vitest';
import { fetchDeployVersion, isRemoteVersionNewer } from './version-check.js';

describe('isRemoteVersionNewer', () => {
  it('detects a different deployed version', () => {
    expect(isRemoteVersionNewer('0.0.0+dev.20250614.120000', '0.0.0+dev.20250614.130000')).toBe(
      true,
    );
  });

  it('returns false when versions match', () => {
    expect(isRemoteVersionNewer('0.0.0+dev.20250614.120000', '0.0.0+dev.20250614.120000')).toBe(
      false,
    );
  });
});

describe('fetchDeployVersion', () => {
  it('reads version.json from the server', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '0.0.0+nogit.20250614.130000' }),
    });

    await expect(fetchDeployVersion(fetchImpl)).resolves.toBe('0.0.0+nogit.20250614.130000');
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringMatching(/^\/version\.json\?ts=\d+$/), {
      cache: 'no-store',
    });
  });

  it('returns null when version.json is unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false });
    await expect(fetchDeployVersion(fetchImpl)).resolves.toBeNull();
  });
});
