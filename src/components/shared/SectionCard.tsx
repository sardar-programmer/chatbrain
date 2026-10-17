import React from 'react';

interface SectionCardProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  title,
  description,
  action,
  children,
  className = '',
  noPadding = false,
}) => {
  return (
    <div
      className={`rounded-card border border-border bg-surface text-text-primary ${
        !noPadding ? 'p-5 sm:p-6' : ''
      } ${className}`}
    >
      {(title || action) && (
        <div
          className={`flex items-center justify-between gap-4 ${
            !noPadding ? 'mb-4' : 'p-5 pb-3'
          }`}
        >
          <div>
            {title && (
              <h2 className="font-serif text-lg font-medium text-text-primary">{title}</h2>
            )}
            {description && (
              <p className="text-xs text-text-secondary mt-0.5">{description}</p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
