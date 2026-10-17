import { create } from 'zustand';
import { STORAGE_KEYS, SIMULATE_ERROR_DEV_KEY } from '../config/constants';

export type ThemeMode = 'light' | 'dark' | 'system';

interface UIState {
  theme: ThemeMode;
  sidebarCollapsed: boolean;
  mobileDrawerOpen: boolean;
  searchOpen: boolean;
  sidebarGroups: Record<string, boolean>;
  devSimulateError: boolean;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileDrawerOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  toggleSidebarGroup: (group: string) => void;
  setSidebarGroupOpen: (group: string, open: boolean) => void;
  setDevSimulateError: (simulate: boolean) => void;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  const urlParam = new URLSearchParams(window.location.search).get('theme') as ThemeMode | null;
  if (urlParam === 'light' || urlParam === 'dark' || urlParam === 'system') return urlParam;
  const stored = localStorage.getItem(STORAGE_KEYS.THEME) as ThemeMode | null;
  return stored || 'system';
}

function getInitialSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  const urlParam = new URLSearchParams(window.location.search).get('collapsed');
  if (urlParam === 'true') return true;
  if (urlParam === 'false') return false;
  return localStorage.getItem(STORAGE_KEYS.SIDEBAR_COLLAPSED) === 'true';
}

function getInitialGroups(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SIDEBAR_GROUPS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function applyThemeToDOM(theme: ThemeMode) {
  if (typeof window === 'undefined') return;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

function applySidebarToDOM(collapsed: boolean) {
  if (typeof window === 'undefined') return;
  if (collapsed) {
    document.documentElement.setAttribute('data-sidebar-collapsed', 'true');
  } else {
    document.documentElement.removeAttribute('data-sidebar-collapsed');
  }
}

export const useUIStore = create<UIState>((set, get) => ({
  theme: getInitialTheme(),
  sidebarCollapsed: getInitialSidebarCollapsed(),
  mobileDrawerOpen: false,
  searchOpen: false,
  sidebarGroups: getInitialGroups(),
  devSimulateError:
    typeof window !== 'undefined'
      ? localStorage.getItem(SIMULATE_ERROR_DEV_KEY) === 'true'
      : false,

  setTheme: (theme: ThemeMode) => {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
    applyThemeToDOM(theme);
    set({ theme });
  },

  toggleSidebar: () => {
    const next = !get().sidebarCollapsed;
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(next));
    applySidebarToDOM(next);
    set({ sidebarCollapsed: next });
  },

  setSidebarCollapsed: (collapsed: boolean) => {
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_COLLAPSED, String(collapsed));
    applySidebarToDOM(collapsed);
    set({ sidebarCollapsed: collapsed });
  },

  setMobileDrawerOpen: (open: boolean) => set({ mobileDrawerOpen: open }),

  setSearchOpen: (open: boolean) => set({ searchOpen: open }),

  toggleSidebarGroup: (group: string) => {
    const current = get().sidebarGroups;
    const next = { ...current, [group]: !current[group] };
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_GROUPS, JSON.stringify(next));
    set({ sidebarGroups: next });
  },

  setSidebarGroupOpen: (group: string, open: boolean) => {
    const current = get().sidebarGroups;
    const next = { ...current, [group]: open };
    localStorage.setItem(STORAGE_KEYS.SIDEBAR_GROUPS, JSON.stringify(next));
    set({ sidebarGroups: next });
  },

  setDevSimulateError: (simulate: boolean) => {
    localStorage.setItem(SIMULATE_ERROR_DEV_KEY, String(simulate));
    set({ devSimulateError: simulate });
  },
}));
