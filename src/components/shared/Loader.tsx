import React from 'react';

interface LoaderProps {
  message?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Loader: React.FC<LoaderProps> = ({
  message = 'Loading...',
  className = '',
  size = 'md',
}) => {
  const spinnerSize = size === 'sm' ? 'h-4 w-4' : size === 'lg' ? 'h-8 w-8' : 'h-5 w-5';

  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 p-6 text-text-secondary ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <svg
          className={`animate-spin text-accent ${spinnerSize}`}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-20"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
      {message && (
        <span className="font-serif text-sm tracking-wide text-text-secondary">{message}</span>
      )}
      <span className="sr-only">{message}</span>
    </div>
  );
};
