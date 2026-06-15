import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

interface NavigationRefreshContextValue {
  refreshKey: number;
  bumpRefresh: () => void;
}

const NavigationRefreshContext = createContext<NavigationRefreshContextValue | null>(null);

export function NavigationRefreshProvider({ children }: { children: ReactNode }) {
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = useCallback(() => {
    setRefreshKey((current) => current + 1);
  }, []);

  const value = useMemo(
    () => ({
      refreshKey,
      bumpRefresh,
    }),
    [bumpRefresh, refreshKey],
  );

  return (
    <NavigationRefreshContext.Provider value={value}>{children}</NavigationRefreshContext.Provider>
  );
}

export function useNavigationRefresh(): NavigationRefreshContextValue {
  const context = useContext(NavigationRefreshContext);
  if (!context) {
    throw new Error('useNavigationRefresh must be used within NavigationRefreshProvider');
  }
  return context;
}
