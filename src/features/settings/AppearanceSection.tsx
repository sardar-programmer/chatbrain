import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { SectionCard } from '../../components/shared/SectionCard';
import { type ThemeMode, useUIStore } from '../../state/useUIStore';

export const AppearanceSection: React.FC = () => {
  const { theme, setTheme } = useUIStore();

  const themeOptions: { mode: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { mode: 'light', label: 'Light', icon: <Sun className="h-4 w-4" /> },
    { mode: 'dark', label: 'Dark', icon: <Moon className="h-4 w-4" /> },
    { mode: 'system', label: 'System', icon: <Monitor className="h-4 w-4" /> },
  ];

  return (
    <SectionCard
      title="Appearance"
      description="Choose how Chat-Brain looks on your device. Applied instantly without flash."
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
  );
};
