import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { SectionCard } from '../../components/shared/SectionCard';
import { useToast } from '../../components/shared/Toast';
import {
  useClearDefaultModelMutation,
  useSetDefaultModelMutation,
} from '../models/hooks/useDefaultModel';
import { useModels, useRefreshModelsMutation } from '../models/hooks/useModels';
import { useCredentials } from './hooks/useCredentials';

export const PreferredModelSection: React.FC = () => {
  const { data: credentials } = useCredentials();
  const { data: modelsData, isLoading } = useModels();
  const refreshMutation = useRefreshModelsMutation();
  const setDefaultMutation = useSetDefaultModelMutation();
  const clearDefaultMutation = useClearDefaultModelMutation();
  const { showToast } = useToast();

  const isConfigured = Boolean(credentials?.configured);
  const models = modelsData?.models ?? [];
  const chatModels = models.filter(m => m.kind === 'chat');
  const defaultModelStatus = modelsData?.default_chat_model;
  const currentModelId = defaultModelStatus?.model_id || '';
  const isInvalid = Boolean(currentModelId && defaultModelStatus && !defaultModelStatus.valid);

  const isUpdating = setDefaultMutation.isPending || clearDefaultMutation.isPending;

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) {
      try {
        await clearDefaultMutation.mutateAsync();
        showToast({ message: 'Preferred model cleared. Automatic selection active.', type: 'info' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to clear preferred model';
        showToast({ message: msg, type: 'error' });
      }
    } else {
      try {
        await setDefaultMutation.mutateAsync({ modelId: val });
        showToast({ message: `Preferred model set to ${val}`, type: 'success' });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to set preferred model';
        showToast({ message: msg, type: 'error' });
      }
    }
  };

  const handleRefresh = async () => {
    try {
      await refreshMutation.mutateAsync();
      showToast({ message: 'Model list refreshed from Google', type: 'success' });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to refresh models';
      showToast({ message: msg, type: 'error' });
    }
  };

  return (
    <SectionCard
      title="Preferred Model (Optional)"
      description="Chat-Brain tries this model first and switches automatically if it is busy."
    >
      <div className="space-y-3 max-w-lg">
        {!isConfigured ? (
          <div className="rounded-md bg-sidebar/50 border border-border/50 p-3 text-xs text-text-tertiary">
            Add your Gemini API key above to load available models.
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="preferred-model-select" className="block text-xs font-medium text-text-secondary mb-1">
                Preferred Chat Model
              </label>
              <select
                id="preferred-model-select"
                aria-label="Preferred chat model"
                value={currentModelId}
                disabled={isUpdating || isLoading}
                onChange={handleChange}
                className="w-full rounded-md border border-border bg-sidebar px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent transition-colors disabled:opacity-50 cursor-pointer"
              >
                <option value="">Automatic (recommended)</option>
                {chatModels.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.display_name} ({m.id})
                  </option>
                ))}
              </select>
            </div>

            {isInvalid && (
              <div
                role="alert"
                className="rounded-md bg-status-warning/10 border border-status-warning/30 p-2.5 flex items-start gap-2 text-xs text-status-warning"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium">Preference notice:</span> Your preferred model (
                  <code>{currentModelId}</code>) is currently invalid or unavailable:{' '}
                  {defaultModelStatus?.reason || 'Not found'}. Chat-Brain will automatically use an available model.
                </div>
              </div>
            )}

            <div className="pt-1">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={refreshMutation.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-text-secondary hover:bg-sidebar-accent transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                {refreshMutation.isPending ? 'Refreshing...' : 'Refresh model list'}
              </button>
            </div>
          </>
        )}
      </div>
    </SectionCard>
  );
};
