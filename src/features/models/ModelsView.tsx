import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, RefreshCw, Search, X } from 'lucide-react';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';
import { Loader } from '../../components/shared/Loader';
import { PageHeader } from '../../components/shared/PageHeader';
import { SectionCard } from '../../components/shared/SectionCard';
import { useToast } from '../../components/shared/Toast';
import { ModelCard } from './ModelCard';
import {
  useClearDefaultModelMutation,
  useSetDefaultModelMutation,
} from './hooks/useDefaultModel';
import { useModels, useRefreshModelsMutation } from './hooks/useModels';
import {
  KIND_CHIPS,
  type KindFilterId,
  countByKind,
  filterModels,
} from './modelFilter';

export const ModelsView: React.FC = () => {
  const { data: modelsData, isLoading, isError } = useModels();
  const refreshMutation = useRefreshModelsMutation();
  const setDefaultMutation = useSetDefaultModelMutation();
  const clearDefaultMutation = useClearDefaultModelMutation();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<KindFilterId>('chat');

  const isConnected = Boolean(modelsData?.connected);
  const models = useMemo(() => modelsData?.models ?? [], [modelsData?.models]);
  const defaultModelStatus = modelsData?.default_chat_model;

  const defaultModelObj = useMemo(() => {
    if (!defaultModelStatus?.model_id) return null;
    return models.find(m => m.id === defaultModelStatus.model_id) ?? null;
  }, [models, defaultModelStatus?.model_id]);

  const counts = useMemo(() => countByKind(models), [models]);
  const filteredModels = useMemo(
    () => filterModels(models, searchQuery, selectedKind),
    [models, searchQuery, selectedKind],
  );

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      showToast({ message: 'Discovered models refreshed from Gemini API', type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh models';
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleSetDefault = async (modelId: string) => {
    try {
      await setDefaultMutation.mutateAsync({ modelId });
      showToast({ message: `Set ${modelId} as default chat model`, type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set default model';
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleClearDefault = async () => {
    try {
      await clearDefaultMutation.mutateAsync();
      showToast({ message: 'Default chat model cleared', type: 'info' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear default model';
      showToast({ message: msg, type: 'error' });
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <Loader message="Loading models..." size="lg" />
      </div>
    );
  }

  if (!isConnected || isError) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
        <PageHeader
          title="Models"
          description="Discovered models, supported capabilities, context windows, and status indicators."
          badge={<HonestBadge variant="disconnected" label="Not connected" />}
        />
        <EmptyState
          iconName="KeyRound"
          title="Connect your Gemini API key to discover models"
          description="Never presenting static or fake model lists. Connect your Gemini API key in API Management to discover and query real models available to your account."
          action={
            <Link
              to="/api-keys"
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
            >
              Go to API Management
            </Link>
          }
        />
      </div>
    );
  }

  const lastCheckedStr = models[0]?.last_checked
    ? new Date(models[0].last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 space-y-6">
      <PageHeader
        title="Models"
        description="Discovered models from Google GenAI, functional kind classification, and default chat model selection."
        badge={<HonestBadge variant="demo" label={`${models.length} discovered`} />}
        actions={
          <div className="flex items-center gap-3">
            {lastCheckedStr && (
              <span className="text-xs text-text-tertiary">Checked {lastCheckedStr}</span>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              {refreshMutation.isPending ? 'Discovering...' : 'Refresh models'}
            </button>
          </div>
        }
      />

      {refreshMutation.isPending && (
        <div className="rounded-card border border-accent/20 bg-accent-soft/30 p-4">
          <Loader message="Discovering available models from Google GenAI..." size="sm" />
        </div>
      )}

      {/* Default Chat Model Card */}
      <SectionCard title="Default Chat Model" noPadding className="p-5">
        {defaultModelStatus?.model_id ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-serif text-base font-medium text-text-primary">
                  {defaultModelObj?.display_name || defaultModelStatus.model_id}
                </span>
                <span className="font-mono text-xs text-text-secondary">({defaultModelStatus.model_id})</span>
                {defaultModelStatus.valid ? (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-status-success/10 text-status-success border border-status-success/20">
                    Active Default
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-status-warning/10 text-status-warning border border-status-warning/20">
                    Invalid ({defaultModelStatus.reason || 'issue'})
                  </span>
                )}
              </div>
              {!defaultModelStatus.valid && (
                <p className="text-xs text-status-warning">
                  Warning:{' '}
                  {defaultModelStatus.reason === 'model_not_found'
                    ? 'This model is no longer present in your discovered models list.'
                    : defaultModelStatus.reason === 'not_a_chat_model'
                      ? 'This model does not report normal chat/text generation capabilities.'
                      : 'Please choose an active chat model below.'}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={handleClearDefault}
              disabled={clearDefaultMutation.isPending}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-sidebar-accent transition-colors shrink-0"
            >
              <X className="h-3.5 w-3.5" />
              Clear default
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between text-xs text-text-secondary py-1">
            <span>No default chat model selected. Choose one from the chat models list below.</span>
          </div>
        )}
      </SectionCard>

      {/* Filters and Search */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-tertiary" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by model ID or display name..."
              className="w-full rounded-md border border-border bg-sidebar pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Kind Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          {KIND_CHIPS.map(chip => {
            const count = counts[chip.id] ?? 0;
            const isSelected = selectedKind === chip.id;
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setSelectedKind(chip.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-accent text-white'
                    : 'bg-surface border border-border text-text-secondary hover:bg-sidebar-accent'
                }`}
              >
                <span>{chip.label}</span>
                <span className={`text-[10px] ${isSelected ? 'text-white/80' : 'text-text-tertiary'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-text-tertiary flex items-center gap-1">
          <Info className="h-3 w-3 shrink-0" />
          Chat means the API reports text generation support; it does not rank quality.
        </p>
      </div>

      {/* Models List */}
      <div className="space-y-2">
        {filteredModels.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-xs text-text-tertiary">
            No models match the filter &ldquo;{selectedKind}&rdquo; {searchQuery && `with query &ldquo;${searchQuery}&rdquo;`}.
          </div>
        ) : (
          filteredModels.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              isDefault={defaultModelStatus?.model_id === model.id}
              onSetDefault={handleSetDefault}
              isSettingDefault={setDefaultMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
};
