import { useEffect, useState } from 'react';
import {
  checkApiReachability,
  getApiReachable,
  subscribeApiConnectivity,
} from '../sync/api-connectivity.js';

/** Whether the sync API is reachable — not just general device connectivity. */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => getApiReachable());

  useEffect(() => {
    checkApiReachability().catch(() => undefined);
    return subscribeApiConnectivity(setOnline);
  }, []);

  return online;
}
