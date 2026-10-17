import React from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useUIStore, ThemeMode } from '../../state/useUIStore';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, setTheme } = useUIStore();

  const cycleTheme = () => {
    const sequence: ThemeMode[] = ['light', 'dark', 'system'];
    const nextIdx = (sequence.indexOf(theme) + 1) % sequence.length;
    setTheme(sequence[nextIdx]);
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      title={`Theme: ${theme} (Click to toggle)`}
      aria-label={`Current theme is ${theme}. Click to switch theme.`}
      className={`inline-flex items-center justify-center p-1.5 text-text-tertiary hover:text-text-primary transition-colors focus:outline-none ${className}`}
    >
      {theme === 'light' && <Sun className="h-4 w-4 stroke-[1.75]" />}
      {theme === 'dark' && <Moon className="h-4 w-4 stroke-[1.75]" />}
      {theme === 'system' && <Monitor className="h-4 w-4 stroke-[1.75]" />}
    </button>
  );
};
