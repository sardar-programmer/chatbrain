import React from 'react';
import { Gauge, RotateCcw } from 'lucide-react';
import { Loader } from '../../components/shared/Loader';

interface AutoPoolSummaryBarProps {
  chatModelCount: number;
  readyCount: number;
  coolingCount: number;
  excludedCount: number;
  lastCheckedTime: string | null;
  onOpenScan: () => void;
  onOpenReset: () => void;
  isScanning: boolean;
  isResetting: boolean;
}

export const AutoPoolSummaryBar: React.FC<AutoPoolSummaryBarProps> = ({
  chatModelCount,
  readyCount,
  coolingCount,
  excludedCount,
  lastCheckedTime,
  onOpenScan,
  onOpenReset,
  isScanning,
  isResetting,
}) => {
  return (
    <div className="rounded-card border border-border bg-surface p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-serif text-sm font-semibold text-text-primary">
            Auto pool status:
          </span>
          <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-pill bg-status-success/10 text-status-success">
            {readyCount} ready
          </span>
          {coolingCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-pill bg-status-warning/10 text-status-warning">
              {coolingCount} cooling down
            </span>
          )}
          {excludedCount > 0 && (
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-pill bg-sidebar text-text-tertiary">
              {excludedCount} excluded
            </span>
          )}
          <span className="text-xs text-text-tertiary">
            ({chatModelCount} total chat models)
          </span>
        </div>
        <p className="text-xs text-text-tertiary mt-1">
          {lastCheckedTime ? `Checked: ${lastCheckedTime}` : 'Live auto-failover metrics'}
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onOpenScan}
          disabled={isScanning}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border bg-surface hover:bg-sidebar transition-colors text-text-primary disabled:opacity-50"
        >
          {isScanning ? <Loader size="sm" /> : <Gauge className="h-3.5 w-3.5 text-accent" />}
          Check speed now
        </button>

        <button
          type="button"
          onClick={onOpenReset}
          disabled={isResetting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-btn border border-border bg-surface hover:bg-sidebar transition-colors text-text-secondary disabled:opacity-50"
        >
          {isResetting ? (
            <Loader size="sm" />
          ) : (
            <RotateCcw className="h-3.5 w-3.5 text-text-tertiary" />
          )}
          Reset stats
        </button>
      </div>
    </div>
  );
};
