import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkApiReachability,
  getApiReachable,
  markApiReachable,
  resetApiConnectivityForTests,
  subscribeApiConnectivity,
} from './api-connectivity.js';
import { getSyncApiUrl } from '../config.js';

describe('api connectivity', () => {
  beforeEach(() => {
    vi.stubGlobal('navigator', { onLine: true });
    resetApiConnectivityForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetApiConnectivityForTests();
  });

  it('returns false when the device is offline', () => {
    vi.stubGlobal('navigator', { onLine: false });
    resetApiConnectivityForTests();
    markApiReachable(true);

    expect(getApiReachable()).toBe(false);
  });

  it('notifies subscribers when reachability changes', () => {
    const listener = vi.fn();
    subscribeApiConnectivity(listener);
    listener.mockClear();

    markApiReachable(false);
    markApiReachable(true);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenNthCalledWith(1, false);
    expect(listener).toHaveBeenNthCalledWith(2, true);
  });

  it('does not notify when reachability is unchanged', () => {
    const listener = vi.fn();
    subscribeApiConnectivity(listener);
    listener.mockClear();

    markApiReachable(true);

    expect(listener).not.toHaveBeenCalled();
  });

  it('checks /v1/health and marks reachable on ok response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    const reachable = await checkApiReachability();

    expect(reachable).toBe(true);
    expect(getApiReachable()).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(getSyncApiUrl('/v1/health'), {
      method: 'GET',
      signal: expect.any(AbortSignal),
      cache: 'no-store',
    });
  });

  it('marks unreachable when health check fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    const reachable = await checkApiReachability();

    expect(reachable).toBe(false);
    expect(getApiReachable()).toBe(false);
  });

  it('marks unreachable when health check throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));

    const reachable = await checkApiReachability();

    expect(reachable).toBe(false);
    expect(getApiReachable()).toBe(false);
  });

  it('skips health check when device is offline', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    resetApiConnectivityForTests();
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const reachable = await checkApiReachability();

    expect(reachable).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
