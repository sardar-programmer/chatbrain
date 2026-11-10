import React from 'react';

interface LogoProps {
  collapsed?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ collapsed = false, className = '', size = 'md' }) => {
  const isLarge = size === 'lg';

  return (
    <div className={`flex items-center select-none ${className}`}>
      <div className={`flex shrink-0 items-center justify-center ${isLarge ? 'h-14 w-14' : 'h-10 w-10'}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-xl border shadow-sm relative overflow-hidden transition-all duration-200 ${
            isLarge
              ? 'h-12 w-12 bg-gradient-to-br from-accent to-accent-hover text-white border-white/20 shadow-md'
              : 'h-8 w-8 bg-gradient-to-br from-accent to-accent-hover text-white border-white/20 shadow-sm'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-white/25 pointer-events-none" />
          <svg
            className={`${isLarge ? 'h-6 w-6' : 'h-4 w-4'}`}
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
        <span className="font-sans text-base font-semibold tracking-tight text-text-primary ml-2 truncate flex items-center gap-1.5">
          Chat-Brain
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        </span>
      )}
    </div>
  );
};
