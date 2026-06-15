import { useNavigationRefresh } from '../../context/NavigationRefreshContext.js';
import { usePendingSyncCount, useSyncErrorCount } from '../../hooks/usePendingSyncCount.js';

export function useSyncNavBadge(): number {
  const { refreshKey } = useNavigationRefresh();
  const pendingSyncCount = usePendingSyncCount(refreshKey);
  const syncErrorCount = useSyncErrorCount(refreshKey);
  return pendingSyncCount + syncErrorCount;
}
