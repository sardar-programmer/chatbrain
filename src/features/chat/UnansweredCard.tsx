import React from 'react';
import { RotateCcw } from 'lucide-react';

interface UnansweredCardProps {
  onRetry: () => void;
  disabled?: boolean;
}

export const UnansweredCard: React.FC<UnansweredCardProps> = ({
  onRetry,
  disabled = false,
}) => {
  return (
    <div className="rounded-xl border border-white/10 bg-sidebar/50 p-3.5 my-2 flex items-center justify-between max-w-xl text-left select-none animate-in fade-in duration-200">
      <div className="text-xs text-text-secondary leading-relaxed">
        No reply yet.
      </div>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        aria-label="Retry answer"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/10 border border-white/10 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        <span>Retry</span>
      </button>
    </div>
  );
};
