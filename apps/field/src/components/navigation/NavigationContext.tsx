import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export interface PageNavigationState {
  title?: string;
  showBack?: boolean;
  backTo?: string;
}

interface NavigationContextValue {
  pageNav: PageNavigationState;
  setPageNav: (state: PageNavigationState) => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const [pageNav, setPageNav] = useState<PageNavigationState>({});

  const value = useMemo(
    () => ({
      pageNav,
      setPageNav,
    }),
    [pageNav],
  );

  return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
}

export function useNavigationContext(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigationContext must be used within NavigationProvider');
  }
  return context;
}
