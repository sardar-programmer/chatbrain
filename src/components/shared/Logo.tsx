import React from 'react';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LogoIcon: React.FC<{ className?: string; size?: 'sm' | 'md' | 'lg' }> = ({
  className = '',
  size = 'md',
}) => {
  const isLarge = size === 'lg';
  return (
    <svg
      className={`shrink-0 text-accent ${isLarge ? 'h-7 w-7' : 'h-6 w-6'} ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M8 12a4 4 0 0 1 8 0" stroke="currentColor" strokeWidth="2" />
      <path d="M12 7v2" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="15" r="1" fill="currentColor" />
    </svg>
  );
};

export const Logo: React.FC<LogoProps> = ({ collapsed = false, className = '', size = 'md' }) => {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <LogoIcon size={size} />
      </div>
      {!collapsed && (
        <span className="font-serif text-lg font-medium tracking-tight text-text-primary ml-1 truncate">
          Chat-Brain
        </span>
      )}
    </div>
  );
};
