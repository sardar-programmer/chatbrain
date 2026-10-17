export const STORAGE_KEYS = {
  THEME: 'chat_brain_theme',
  SIDEBAR_COLLAPSED: 'chat_brain_sidebar_collapsed',
  SIDEBAR_GROUPS: 'chat_brain_sidebar_groups',
  CORRUPT_BACKUP: 'chat_brain_corrupt_backup',
  CONVERSATIONS: 'chat_brain_conversations',
  PROJECTS: 'chat_brain_projects',
  DATASETS: 'chat_brain_datasets',
  MEMORY: 'chat_brain_memory',
  SETTINGS: 'chat_brain_settings',
} as const;

export const APP_LIMITS = {
  MAX_SIDEBAR_RECENTS: 8,
  SEARCH_DEBOUNCE_MS: 150,
  STREAM_THROTTLE_MS: 300,
  CORRUPT_BACKUP_MAX_ITEMS: 50,
} as const;

export const SIMULATE_ERROR_DEV_KEY = 'chat_brain_dev_simulate_error';
