import React from 'react';
import { getIcon } from './IconRegistry';

interface EmptyStateProps {
  iconName?: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  iconName = 'Compass',
  title,
  description,
  action,
  className = '',
}) => {
  const IconComponent = getIcon(iconName);

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center max-w-md mx-auto my-auto ${className}`}
    >
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/70 dark:border-white/10 bg-surface/70 dark:bg-surface/40 backdrop-blur-xl text-accent mb-4 shadow-sm">
        <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-md pointer-events-none" />
        <IconComponent className="h-6 w-6 stroke-[1.8] relative z-10" />
      </div>
      <h3 className="font-sans text-lg font-semibold text-text-primary mb-1.5 tracking-tight">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed mb-5">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
