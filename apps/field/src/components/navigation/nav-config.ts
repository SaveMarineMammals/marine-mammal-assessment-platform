export type NavItemId = 'assessments' | 'new' | 'sync' | 'settings';

export interface NavItem {
  id: NavItemId;
  label: string;
  shortLabel: string;
  to: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'assessments',
    label: 'Assessments',
    shortLabel: 'List',
    to: '/',
    end: true,
  },
  {
    id: 'new',
    label: 'New',
    shortLabel: 'New',
    to: '/assessments/new',
  },
  {
    id: 'sync',
    label: 'Sync',
    shortLabel: 'Sync',
    to: '/sync',
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'Settings',
    to: '/settings',
  },
];

export function getActiveNavId(pathname: string): NavItemId {
  if (pathname === '/settings') {
    return 'settings';
  }
  if (pathname === '/sync') {
    return 'sync';
  }
  if (pathname === '/assessments/new') {
    return 'new';
  }
  if (pathname.startsWith('/assessments/')) {
    return 'assessments';
  }
  return 'assessments';
}

export function getDefaultPageTitle(pathname: string): string {
  if (pathname === '/settings') {
    return 'Settings';
  }
  if (pathname === '/sync') {
    return 'Sync';
  }
  if (pathname === '/assessments/new') {
    return 'New Assessment';
  }
  if (pathname.startsWith('/assessments/')) {
    return 'Assessment';
  }
  return 'Assessments';
}
