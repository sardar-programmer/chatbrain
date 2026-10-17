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
      <div className="flex h-12 w-12 items-center justify-center rounded-card bg-accent-soft text-accent mb-4">
        <IconComponent className="h-6 w-6 stroke-[1.75]" />
      </div>
      <h3 className="font-serif text-lg font-medium text-text-primary mb-1.5">{title}</h3>
      <p className="text-sm text-text-secondary leading-relaxed mb-5">{description}</p>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
};
