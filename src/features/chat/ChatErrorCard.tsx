import React from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { getErrorMessage } from './errorMessages';

interface ChatErrorCardProps {
  errorCategory?: string | null;
  rawMessage?: string | null;
  onRetry?: () => void;
  isStreaming?: boolean;
}

export const ChatErrorCard: React.FC<ChatErrorCardProps> = ({
  errorCategory,
  rawMessage,
  onRetry,
  isStreaming = false,
}) => {
  const { message: errorText, action } = getErrorMessage({
    code: errorCategory,
    message: rawMessage,
  });

  return (
    <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-3.5 my-2 flex flex-col gap-2 max-w-xl text-left select-none">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="h-4 w-4 text-status-error shrink-0 mt-0.5" />
        <div className="flex-1 text-xs text-status-error leading-relaxed">
          {errorText}
        </div>
      </div>

      {action === 'retry' && onRetry && (
        <div className="pt-0.5 pl-6.5">
          <button
            type="button"
            onClick={onRetry}
            disabled={isStreaming}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-error/15 text-status-error hover:bg-status-error/25 border border-status-error/30 transition-colors disabled:opacity-50 cursor-pointer focus:outline-none"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

      {action === 'settings' && (
        <div className="pt-0.5 pl-6.5">
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-status-error/15 text-status-error hover:bg-status-error/25 border border-status-error/30 transition-colors cursor-pointer focus:outline-none"
          >
            <span>Open Settings</span>
          </Link>
        </div>
      )}
    </div>
  );
};
