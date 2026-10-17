import React from 'react';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ collapsed = false, className = '' }) => {
  return (
    <div className={`flex items-center select-none ${className}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
            <path d="M8 12a4 4 0 0 1 8 0" />
            <path d="M12 8v1" />
            <path d="M10 16h4" />
          </svg>
        </div>
      </div>
      {!collapsed && (
        <span className="font-serif text-lg font-semibold tracking-tight text-text-primary ml-2 truncate">
          Chat-Brain
        </span>
      )}
    </div>
  );
};
