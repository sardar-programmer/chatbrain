import React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';

interface NavTooltipProps {
  content: string;
  children: React.ReactNode;
  enabled?: boolean;
}

export const NavTooltip: React.FC<NavTooltipProps> = ({ content, children, enabled = true }) => {
  if (!enabled) return <>{children}</>;

  return (
    <Tooltip.Root delayDuration={150}>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          side="right"
          sideOffset={8}
          className="z-50 select-none rounded-md border border-border bg-elevated px-2.5 py-1 text-xs font-medium text-text-primary shadow-subtle animate-in fade-in-50 zoom-in-95"
        >
          {content}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
};
