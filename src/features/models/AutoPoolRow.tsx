import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Model, ModelHealthItem } from '../../services/api/types';
import {
  deriveModelState,
  formatCountdown,
  formatTtft,
  friendlyErrorCode,
} from './poolHelpers';

interface AutoPoolRowProps {
  model: Model;
  health: ModelHealthItem | undefined;
  isPreferred: boolean;
  isExcluded: boolean;
  tryOrder: number | null;
  now: Date;
  onToggleExcluded: (modelId: string, excluded: boolean) => void;
  isToggling: boolean;
}

export const AutoPoolRow: React.FC<AutoPoolRowProps> = ({
  model,
  health,
  isPreferred,
  isExcluded,
  tryOrder,
  now,
  onToggleExcluded,
  isToggling,
}) => {
  const state = deriveModelState(health, isExcluded, now);
  const countdown = formatCountdown(health?.cooldown_until, now);

  const stateBadge = (() => {
    switch (state) {
      case 'ready':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-status-success/10 text-status-success border border-status-success/20">
            Ready
          </span>
        );
      case 'cooling':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-status-warning/10 text-status-warning border border-status-warning/20">
            Cooling down ({countdown})
          </span>
        );
      case 'excluded':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-sidebar text-text-tertiary border border-border">
            Excluded
          </span>
        );
      case 'new':
        return (
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-status-info/10 text-status-info border border-status-info/20">
            New
          </span>
        );
    }
  })();

  const ttftDisplay = formatTtft(health?.ttft_ms_ewma);
  const errorText = health?.last_error_code
    ? friendlyErrorCode(health.last_error_code)
    : 'None';

  return (
    <div
      className={`rounded-card border p-3.5 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
        isExcluded
          ? 'bg-sidebar/40 border-border/60 opacity-80'
          : isPreferred
            ? 'bg-accent-soft/15 border-accent/40'
            : 'bg-surface border-border'
      }`}
    >
      <div className="flex items-start md:items-center gap-3 min-w-0">
        <span
          className="shrink-0 font-mono text-xs font-semibold text-text-tertiary w-6 text-center pt-0.5 md:pt-0"
          title={tryOrder ? `Try-order #${tryOrder}` : 'Excluded from auto pool'}
        >
          {tryOrder ? `#${tryOrder}` : '—'}
        </span>

        <div className="space-y-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-serif text-sm font-medium text-text-primary truncate">
              {model.display_name}
            </span>
            <code className="rounded bg-sidebar px-1.5 py-0.5 text-[11px] font-mono text-text-secondary border border-border/40">
              {model.id}
            </code>
            {isPreferred && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-pill bg-accent text-white">
                <Sparkles className="h-3 w-3" />
                Preferred
              </span>
            )}
            {stateBadge}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary">
            <span>
              Avg first word:{' '}
              <strong className="font-mono text-text-secondary font-normal">
                {ttftDisplay}
              </strong>
            </span>
            <span>•</span>
            <span>
              Calls:{' '}
              <span className="text-status-success font-mono">
                ✓ {health?.successes ?? 0}
              </span>{' '}
              ·{' '}
              <span className="text-status-error font-mono">
                ✗ {health?.failures ?? 0}
              </span>
            </span>
            {health?.last_error_code && (
              <>
                <span>•</span>
                <span className="text-status-warning truncate max-w-[200px]" title={errorText}>
                  Error: {errorText}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end md:self-center shrink-0">
        <label
          htmlFor={`pool-switch-${model.id}`}
          className={`flex items-center gap-2 text-xs font-medium ${
            isPreferred
              ? 'cursor-not-allowed opacity-60 text-text-tertiary'
              : 'cursor-pointer text-text-secondary'
          }`}
          title={
            isPreferred
              ? 'Clear the preferred model first to exclude it from the auto pool'
              : undefined
          }
        >
          <span>In auto pool</span>
          <input
            id={`pool-switch-${model.id}`}
            type="checkbox"
            role="switch"
            checked={!isExcluded}
            disabled={isPreferred || isToggling}
            onChange={e => onToggleExcluded(model.id, !e.target.checked)}
            className="h-4 w-4 rounded border-border text-accent focus:ring-accent cursor-pointer disabled:cursor-not-allowed"
          />
        </label>
      </div>
    </div>
  );
};
