import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, RefreshCw, ShieldCheck } from 'lucide-react';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';
import { Loader } from '../../components/shared/Loader';
import { PageHeader } from '../../components/shared/PageHeader';
import { useToast } from '../../components/shared/Toast';
import { AutoPoolSection } from './AutoPoolSection';
import { ModelsDiscoveryList } from './ModelsDiscoveryList';
import { PreferredModelCard } from './PreferredModelCard';
import {
  useClearDefaultModelMutation,
  useSetDefaultModelMutation,
} from './hooks/useDefaultModel';
import { useModels, useRefreshModelsMutation } from './hooks/useModels';

type ModelsTab = 'pool' | 'all';

export const ModelsView: React.FC = () => {
  const { data: modelsData, isLoading, isError } = useModels();
  const refreshMutation = useRefreshModelsMutation();
  const setDefaultMutation = useSetDefaultModelMutation();
  const clearDefaultMutation = useClearDefaultModelMutation();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ModelsTab>('pool');

  const isConnected = Boolean(modelsData?.connected);
  const models = useMemo(() => modelsData?.models ?? [], [modelsData?.models]);
  const defaultModelStatus = modelsData?.default_chat_model;

  const defaultModelObj = useMemo(() => {
    if (!defaultModelStatus?.model_id) return null;
    return models.find(m => m.id === defaultModelStatus.model_id) ?? null;
  }, [models, defaultModelStatus?.model_id]);

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
      showToast({ message: `Set ${modelId} as preferred model`, type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set preferred model';
      showToast({ message: msg, type: 'error' });
    }
  };

  const handleClearDefault = async () => {
    try {
      await clearDefaultMutation.mutateAsync();
      showToast({ message: 'Preferred model cleared', type: 'info' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to clear preferred model';
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
        description="Auto-failover pool controls, speed diagnostics, and model discovery registry."
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

      {/* Preferred Model (Optional) */}
      <PreferredModelCard
        defaultModelStatus={defaultModelStatus}
        defaultModelObj={defaultModelObj}
        onClearDefault={handleClearDefault}
        isClearing={clearDefaultMutation.isPending}
      />

      {/* Tabs navigation */}
      <div className="flex border-b border-border gap-6 text-sm font-medium">
        <button
          type="button"
          onClick={() => setActiveTab('pool')}
          className={`flex items-center gap-2 pb-2.5 transition-colors border-b-2 -mb-px text-xs font-medium ${
            activeTab === 'pool'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <ShieldCheck className="h-4 w-4" />
          Auto pool & speed
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('all')}
          className={`flex items-center gap-2 pb-2.5 transition-colors border-b-2 -mb-px text-xs font-medium ${
            activeTab === 'all'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          <Layers className="h-4 w-4" />
          All discovered models ({models.length})
        </button>
      </div>

      {activeTab === 'pool' ? (
        <AutoPoolSection
          models={models}
          preferredModelId={defaultModelStatus?.model_id}
          lastCheckedTime={lastCheckedStr}
        />
      ) : (
        <ModelsDiscoveryList
          models={models}
          defaultModelId={defaultModelStatus?.model_id}
          onSetDefault={handleSetDefault}
          isSettingDefault={setDefaultMutation.isPending}
        />
      )}
    </div>
  );
};
