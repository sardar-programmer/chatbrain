import React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Wrench } from 'lucide-react';
import { useUIStore } from '../../state/useUIStore';
import { NavTooltip } from './NavTooltip';

interface DeveloperRowProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export const DeveloperRow: React.FC<DeveloperRowProps> = ({ collapsed }) => {
  const { devSimulateError, setDevSimulateError } = useUIStore();

  if (!import.meta.env.DEV) return null;

  const trigger = (
    <PopoverPrimitive.Trigger asChild>
      <button
        type="button"
        aria-label="Developer controls (Dev only)"
        className={`flex h-10 items-center rounded-md transition-colors focus:outline-none shrink-0 text-text-secondary hover:bg-sidebar-accent hover:text-text-primary ${
          collapsed ? 'w-10 justify-center' : 'w-full'
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          <Wrench className="h-4 w-4 stroke-[1.75] shrink-0" />
        </div>
        {!collapsed && (
          <div className="flex flex-1 items-center justify-between min-w-0 pr-2">
            <span className="truncate text-xs">Developer</span>
            <span className="rounded bg-accent-soft px-1 py-0.2 text-[9px] font-mono font-medium text-accent uppercase shrink-0">
              Dev
            </span>
          </div>
        )}
      </button>
    </PopoverPrimitive.Trigger>
  );

  return (
    <PopoverPrimitive.Root>
      {collapsed ? (
        <NavTooltip content="Developer (Dev only)">{trigger}</NavTooltip>
      ) : (
        trigger
      )}

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="right"
          align="center"
          sideOffset={12}
          className="z-50 w-64 rounded-md border border-border bg-surface p-3.5 shadow-lg text-xs animate-in fade-in zoom-in-95"
        >
          <div className="font-mono text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-1">
            Developer Controls
          </div>
          <p className="text-text-secondary text-[11px] mb-3 leading-relaxed">
            Deterministic QA testing options. Excluded from production.
          </p>

          <label className="flex items-center justify-between gap-2 cursor-pointer select-none py-1">
            <span className="text-text-primary font-medium">Simulate network error</span>
            <input
              type="checkbox"
              checked={devSimulateError}
              onChange={e => setDevSimulateError(e.target.checked)}
              className="rounded border-border text-accent focus:ring-0 focus:outline-none h-4 w-4"
            />
          </label>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};
