import React from 'react';
import { ArrowRight, History } from 'lucide-react';
import { SectionCard } from '../../components/shared/SectionCard';
import { useFailovers } from '../models/hooks/useModelPool';
import { friendlyErrorCode } from '../models/poolHelpers';

function formatEventTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const RecentFailoversCard: React.FC = () => {
  const { data: failovers, isLoading } = useFailovers(10);

  return (
    <SectionCard
      title="Recent Failovers"
      description="Automatic model transitions and round retries triggered during chat completions."
      noPadding
      className="p-5"
    >
      {isLoading ? (
        <div className="py-6 text-center text-xs text-text-tertiary">
          Loading failovers...
        </div>
      ) : !failovers || failovers.length === 0 ? (
        <div className="py-6 text-center text-xs text-text-tertiary flex flex-col items-center justify-center gap-1.5">
          <History className="h-4 w-4 opacity-40" />
          <span>No failovers yet</span>
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          {failovers.map((ev, idx) => {
            const reason = friendlyErrorCode(ev.code);
            return (
              <div
                key={idx}
                className="py-2.5 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-text-tertiary shrink-0">
                    {formatEventTime(ev.at)}
                  </span>
                  <div className="flex items-center gap-1.5 font-mono text-[11px] truncate">
                    <span className="text-text-primary font-medium">{ev.from_model}</span>
                    <ArrowRight className="h-3 w-3 text-text-tertiary shrink-0" />
                    <span className={ev.to_model ? 'text-accent font-medium' : 'text-text-tertiary italic'}>
                      {ev.to_model || 'none'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="rounded bg-status-warning/10 text-status-warning border border-status-warning/20 px-2 py-0.5 text-[10px] font-medium"
                    title={`Code: ${ev.code}`}
                  >
                    {reason}
                  </span>
                  <span className="text-[10px] font-mono text-text-tertiary bg-sidebar px-1.5 py-0.5 rounded border border-border/40">
                    Round {ev.round}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </SectionCard>
  );
};
