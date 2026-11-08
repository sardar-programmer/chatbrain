import React from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Layers,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { HonestBadge } from '../../components/shared/HonestBadge';
import { Loader } from '../../components/shared/Loader';
import { PageHeader } from '../../components/shared/PageHeader';
import { SectionCard } from '../../components/shared/SectionCard';
import { RecentFailoversCard } from './RecentFailoversCard';
import { StatusDiagnosticsGrid } from './StatusDiagnosticsGrid';
import { useStatus } from './hooks/useStatus';

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'None recorded';
  try {
    return new Date(iso).toLocaleString([], {
      dateStyle: 'short',
      timeStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

export const StatusView: React.FC = () => {
  const { data: status, isLoading, isError, refetch, isFetching } = useStatus();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 space-y-6">
      <PageHeader
        title="System Status"
        description="Local environment diagnostics, database health, API credentials, and engine status."
        badge={
          <HonestBadge
            variant={status?.api === 'ok' ? 'demo' : 'disconnected'}
            label={status?.api === 'ok' ? 'Local engine active' : 'Backend offline'}
          />
        }
        actions={
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-sidebar-accent transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {isLoading ? (
        <div className="py-12 text-center">
          <Loader message="Checking system status..." size="md" />
        </div>
      ) : isError || !status ? (
        <div className="rounded-card border border-status-error/30 bg-status-error/10 p-6 text-center space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-status-error/20 text-status-error mx-auto">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3 className="font-serif text-base font-medium text-text-primary">
            Backend not reachable
          </h3>
          <p className="text-xs text-text-secondary max-w-sm mx-auto">
            Backend not reachable. Start it with{' '}
            <code className="bg-sidebar px-1 py-0.5 rounded font-mono">npm run dev</code> or{' '}
            <code className="bg-sidebar px-1 py-0.5 rounded font-mono">npm run dev:api</code>.
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Retry connection
          </button>
        </div>
      ) : (
        <>
          {/* Diagnostic Status Cards Grid */}
          <StatusDiagnosticsGrid status={status} />

          {/* Model & Auto Pool Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Auto Pool Card */}
            <SectionCard title="Auto Pool" noPadding className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-serif font-medium text-text-primary">
                    {status.pool_summary?.ready_count ?? 0}
                    <span className="text-xs font-normal text-text-secondary ml-1">ready</span>
                  </div>
                  <div className="text-xs text-text-secondary mt-1 flex flex-wrap gap-1">
                    <span className="text-status-warning font-medium">
                      {status.pool_summary?.cooling_count ?? 0} cooling
                    </span>
                    <span>·</span>
                    <span className="text-text-tertiary">
                      {status.pool_summary?.excluded_count ?? 0} excluded
                    </span>
                  </div>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-card bg-sidebar text-accent">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-text-tertiary">
                Failovers (24h):{' '}
                <strong className="text-text-secondary font-mono font-normal">
                  {status.failover_count_24h ?? 0}
                </strong>
              </div>
            </SectionCard>

            {/* Models Discovered */}
            <SectionCard title="Models Discovery" noPadding className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-2xl font-serif font-medium text-text-primary">
                    {status.models_count}
                  </div>
                  <p className="text-xs text-text-secondary mt-1">
                    Models registered in SQLite model cache
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-card bg-sidebar text-accent">
                  <Layers className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-text-tertiary">
                Last checked: {formatTimestamp(status.models_last_checked)}
              </div>
            </SectionCard>

            {/* Preferred Model (Optional) */}
            <SectionCard title="Preferred model (optional)" noPadding className="p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 pr-2">
                  <div className="text-base font-serif font-medium text-text-primary truncate">
                    {status.default_chat_model?.model_id || 'None selected'}
                  </div>
                  <p className="text-xs text-text-secondary mt-1 truncate">
                    {status.default_chat_model?.model_id
                      ? status.default_chat_model.valid
                        ? 'Active and verified'
                        : `Invalid (${status.default_chat_model.reason || 'issue'})`
                      : 'Fastest available model will be used'}
                  </p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-card bg-sidebar text-accent shrink-0">
                  <Sparkles className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 text-[11px] text-text-tertiary truncate">
                {status.default_chat_model?.model_id
                  ? 'Configured in Models'
                  : 'Optional configuration'}
              </div>
            </SectionCard>
          </div>

          {/* Recent Failovers */}
          <RecentFailoversCard />

          {/* Provider Call Health Logs */}
          <SectionCard
            title="Provider Communication Diagnostics"
            description="Recent upstream Google GenAI call telemetry. Strictly sanitized: never reveals keys or prompt contents."
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-md bg-sidebar p-3 border border-border/40 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                  <CheckCircle2 className="h-3.5 w-3.5 text-status-success" />
                  Last Successful Provider Call
                </div>
                <p className="text-xs text-text-secondary font-mono">
                  {formatTimestamp(status.last_provider_success_at)}
                </p>
              </div>

              <div className="rounded-md bg-sidebar p-3 border border-border/40 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                  <Activity className="h-3.5 w-3.5 text-text-tertiary" />
                  Last Provider Error
                </div>
                {status.last_provider_error ? (
                  <p className="text-xs text-status-warning font-mono">
                    Category: {status.last_provider_error.category} at{' '}
                    {formatTimestamp(status.last_provider_error.at)}
                  </p>
                ) : (
                  <p className="text-xs text-text-tertiary">None (All systems nominal)</p>
                )}
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
};
