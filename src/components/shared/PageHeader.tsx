import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  badge,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-border mb-6 ${className}`}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-text-primary">
            {title}
          </h1>
          {badge}
        </div>
        {description && (
          <p className="text-sm text-text-secondary max-w-2xl leading-relaxed">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2.5 shrink-0">{actions}</div>}
    </div>
  );
};
