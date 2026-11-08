export interface NavItem {
  id: string;
  label: string;
  iconName: string;
  route: string;
  blurb?: string;
}

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    iconName: 'MessageSquare',
    route: '/',
    blurb: 'Personal AI study assistant and tutor',
  },
  {
    id: 'settings',
    label: 'Settings',
    iconName: 'Settings',
    route: '/settings',
    blurb: 'Manage API keys, model preferences, and appearance',
  },
];

export const ALL_NAV_ITEMS = [...MAIN_NAV_ITEMS];
