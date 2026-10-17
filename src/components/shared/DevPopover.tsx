import React from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Wrench } from 'lucide-react';
import { useUIStore } from '../../state/useUIStore';

export const DevPopover: React.FC = () => {
  const { devSimulateError, setDevSimulateError } = useUIStore();

  if (!import.meta.env.DEV) return null;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          title="Developer Tools (Dev Mode Only)"
          aria-label="Developer settings"
          className="p-1 rounded text-text-tertiary hover:text-text-primary transition-colors focus:outline-none"
        >
          <Wrench className="h-3.5 w-3.5 stroke-[1.75]" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-64 rounded-md border border-border bg-surface p-3.5 shadow-lg text-xs animate-in fade-in"
        >
          <div className="font-mono text-[11px] font-semibold text-text-primary uppercase tracking-wider mb-2">
            Developer Controls
          </div>
          <p className="text-text-secondary text-[11px] mb-3 leading-relaxed">
            Deterministic QA testing options. Excluded from production.
          </p>

          <label className="flex items-center justify-between gap-2 cursor-pointer select-none py-1">
            <span className="text-text-primary font-medium">Force Mock Stream Error</span>
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
