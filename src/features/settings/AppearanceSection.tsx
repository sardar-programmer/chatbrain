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
      <div className="inline-flex rounded-xl border border-white/60 dark:border-white/10 bg-surface/50 dark:bg-surface/30 backdrop-blur-xl p-1 gap-1 shadow-inner">
        {themeOptions.map(({ mode, label, icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => setTheme(mode)}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-medium transition-all duration-150 ${
              theme === mode
                ? 'bg-gradient-to-r from-accent to-accent-hover text-white shadow-sm font-semibold'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface/50'
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
