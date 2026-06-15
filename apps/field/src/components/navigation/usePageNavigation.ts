import { useEffect } from 'react';
import { useNavigationContext, type PageNavigationState } from './NavigationContext.js';

export function usePageNavigation(state: PageNavigationState): void {
  const { setPageNav } = useNavigationContext();

  useEffect(() => {
    setPageNav(state);
    return () => setPageNav({});
  }, [setPageNav, state.backTo, state.showBack, state.title]);
}
