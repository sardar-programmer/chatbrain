import React from 'react';

export type HonestBadgeVariant = 'demo' | 'sample' | 'disconnected' | 'soon';

interface HonestBadgeProps {
  variant?: HonestBadgeVariant;
  label?: string;
  className?: string;
}

export const HonestBadge: React.FC<HonestBadgeProps> = ({
  variant = 'demo',
  label,
  className = '',
}) => {
  const defaultLabels: Record<HonestBadgeVariant, string> = {
    demo: 'Demo response',
    sample: 'Sample data',
    disconnected: 'Not connected yet',
    soon: 'Soon',
  };

  const displayText = label || defaultLabels[variant];

  const variantStyles: Record<HonestBadgeVariant, string> = {
    demo: 'bg-accent-soft/70 text-accent border border-accent/20',
    sample: 'bg-status-info/10 text-status-info border border-status-info/20',
    disconnected: 'bg-text-tertiary/10 text-text-secondary border border-border',
    soon: 'bg-text-tertiary/15 text-text-tertiary border border-border',
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-pill tracking-tight select-none ${variantStyles[variant]} ${className}`}
    >
      {displayText}
    </span>
  );
};
