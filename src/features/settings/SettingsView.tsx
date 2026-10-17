import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { SectionCard } from '../../components/shared/SectionCard';
import { useUIStore, ThemeMode } from '../../state/useUIStore';

export const SettingsView: React.FC = () => {
  const { theme, setTheme } = useUIStore();

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { mode: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { mode: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 space-y-6">
      <PageHeader
        title="Settings"
        description="Application preferences, appearance, local data directories, and backup controls."
      />

      {/* Theme Segmented Control */}
      <SectionCard
        title="Appearance & Theme"
        description="Choose how Chat-Brain looks on your device. Applied before first paint without flash."
      >
        <div className="inline-flex rounded-md border border-border bg-sidebar p-1 gap-1">
          {themeOptions.map(({ mode, label, icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setTheme(mode)}
              className={`flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                theme === mode
                  ? 'bg-surface text-accent shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Local Storage & Data Directory */}
      <SectionCard
        title="Data Storage & Limits"
        description="Single-user local persistence information."
      >
        <div className="space-y-3 text-xs text-text-secondary">
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="font-medium text-text-primary">Storage Engine</span>
            <span className="font-mono">Browser LocalStorage (SQLite in Phase U7)</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="font-medium text-text-primary">Data Directory</span>
            <span className="font-mono text-[11px]">~/.chat-brain/local_data</span>
          </div>
          <div className="flex items-center justify-between py-1 border-b border-border/40">
            <span className="font-medium text-text-primary">Max Sidebar Recents</span>
            <span className="font-mono">8</span>
          </div>
          <div className="flex items-center justify-between py-1">
            <span className="font-medium text-text-primary">Search Debounce</span>
            <span className="font-mono">150 ms</span>
          </div>
        </div>
      </SectionCard>

      {/* Backup & Restore */}
      <SectionCard
        title="Backup & Export"
        description="Save your local chats, notes, and datasets to disk."
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled
            className="rounded-md border border-border bg-sidebar px-3 py-1.5 text-xs font-medium text-text-tertiary cursor-not-allowed"
          >
            Create Backup Bundle (Disabled)
          </button>
          <button
            type="button"
            disabled
            className="rounded-md border border-border bg-sidebar px-3 py-1.5 text-xs font-medium text-text-tertiary cursor-not-allowed"
          >
            Restore Backup (Disabled)
          </button>
        </div>
        <p className="text-[11px] text-text-tertiary mt-2">
          Backup and restore will connect to the local SQLite database adapter in Phase U6.
        </p>
      </SectionCard>

      {/* About & Version */}
      <div className="text-center py-4 text-xs text-text-tertiary">
        Chat-Brain v1.0.0-foundation · Phase U1 · Personal Single-User Workspace
      </div>
    </div>
  );
};
