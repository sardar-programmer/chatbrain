import React, { useEffect, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { Loader } from '../../components/shared/Loader';
import { useToast } from '../../components/shared/Toast';
import type { Model, ModelHealthItem } from '../../services/api/types';
import { AutoPoolRow } from './AutoPoolRow';
import { AutoPoolSummaryBar } from './AutoPoolSummaryBar';
import {
  useModelsHealth,
  usePool,
  useResetHealthMutation,
  useScanModelsMutation,
  useSetPoolExcludedMutation,
} from './hooks/useModelPool';
import { summarize } from './poolHelpers';

interface AutoPoolSectionProps {
  models: Model[];
  preferredModelId: string | null | undefined;
  lastCheckedTime: string | null;
}

export const AutoPoolSection: React.FC<AutoPoolSectionProps> = ({
  models,
  preferredModelId,
  lastCheckedTime,
}) => {
  const { data: healthData, isLoading: isHealthLoading } = useModelsHealth();
  const { data: poolData } = usePool();
  const setExcludedMutation = useSetPoolExcludedMutation();
  const scanMutation = useScanModelsMutation();
  const resetMutation = useResetHealthMutation();
  const { showToast } = useToast();

  const [confirmScanOpen, setConfirmScanOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const healthMap = useMemo(() => {
    const map = new Map<string, ModelHealthItem>();
    if (healthData?.models) {
      for (const m of healthData.models) map.set(m.model_id, m);
    }
    return map;
  }, [healthData]);

  const excludedSet = useMemo(() => new Set(poolData?.excluded ?? []), [poolData]);

  const chatModels = useMemo(() => models.filter(m => m.kind === 'chat'), [models]);

  const orderedChatModels = useMemo(() => {
    const rankedIds = healthData?.ranked ?? [];
    const rankedSet = new Set(rankedIds);
    const rankedList: Model[] = [];

    for (const rid of rankedIds) {
      const match = chatModels.find(m => m.id === rid);
      if (match) rankedList.push(match);
    }

    const rest = chatModels.filter(m => !rankedSet.has(m.id));
    return [...rankedList, ...rest];
  }, [chatModels, healthData]);

  const counts = useMemo(() => {
    if (poolData) {
      return {
        chat_model_count: poolData.chat_model_count,
        ready_count: poolData.ready_count,
        cooling_count: poolData.cooling_count,
        excluded_count: poolData.excluded_count,
      };
    }
    const items = chatModels.map(m => {
      const h = healthMap.get(m.id);
      return {
        kind: 'chat',
        excluded: excludedSet.has(m.id),
        in_cooldown: h?.in_cooldown,
        cooldown_until: h?.cooldown_until,
      };
    });
    return summarize(items, now);
  }, [poolData, chatModels, healthMap, excludedSet, now]);

  const handleToggleExcluded = async (modelId: string, excluded: boolean) => {
    try {
      await setExcludedMutation.mutateAsync({ modelId, excluded });
      showToast({
        type: 'success',
        message: excluded
          ? `Model ${modelId} excluded from auto pool`
          : `Model ${modelId} included in auto pool`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update auto pool';
      showToast({ type: 'error', message });
    }
  };

  const handleScanConfirm = async () => {
    try {
      const res = await scanMutation.mutateAsync();
      const tested = res.results.length;
      const successes = res.results.filter(r => r.ok).length;
      showToast({
        type: 'success',
        message: `Speed scan completed: ${successes}/${tested} chat models responsive.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Speed scan failed';
      showToast({ type: 'error', message });
    }
  };

  const handleResetConfirm = async () => {
    try {
      await resetMutation.mutateAsync();
      showToast({
        type: 'info',
        message: 'Model stats and cooldowns have been reset.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to reset stats';
      showToast({ type: 'error', message });
    }
  };

  let tryOrderCounter = 1;

  return (
    <div className="space-y-4">
      <AutoPoolSummaryBar
        chatModelCount={counts.chat_model_count}
        readyCount={counts.ready_count}
        coolingCount={counts.cooling_count}
        excludedCount={counts.excluded_count}
        lastCheckedTime={lastCheckedTime}
        onOpenScan={() => setConfirmScanOpen(true)}
        onOpenReset={() => setConfirmResetOpen(true)}
        isScanning={scanMutation.isPending}
        isResetting={resetMutation.isPending}
      />

      <p className="text-xs text-text-secondary leading-relaxed">
        Chat-Brain picks the fastest available model automatically for each reply. Models
        with errors cool down briefly before being retried. You can exclude specific models
        from the pool below.
      </p>

      {isHealthLoading && orderedChatModels.length === 0 ? (
        <div className="flex justify-center p-8">
          <Loader size="md" />
        </div>
      ) : orderedChatModels.length === 0 ? (
        <div className="rounded-card border border-border bg-surface p-8 text-center text-xs text-text-tertiary">
          No chat models found in your discovered models list.
        </div>
      ) : (
        <div className="space-y-2">
          {orderedChatModels.map(m => {
            const isPreferred = preferredModelId === m.id;
            const isExcluded = excludedSet.has(m.id);
            const tryOrder = !isExcluded ? tryOrderCounter++ : null;
            return (
              <AutoPoolRow
                key={m.id}
                model={m}
                health={healthMap.get(m.id)}
                isPreferred={isPreferred}
                isExcluded={isExcluded}
                tryOrder={tryOrder}
                now={now}
                onToggleExcluded={handleToggleExcluded}
                isToggling={setExcludedMutation.isPending}
              />
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={confirmScanOpen}
        onOpenChange={setConfirmScanOpen}
        title="Check model speed"
        description="This sends a few tiny test requests to Google (uses a little quota)"
        confirmText="Check speed"
        onConfirm={handleScanConfirm}
      />

      <ConfirmDialog
        open={confirmResetOpen}
        onOpenChange={setConfirmResetOpen}
        title="Reset model stats"
        description="This clears cooldowns and speed records, but your settings and preferred model are kept."
        confirmText="Reset stats"
        isDestructive
        onConfirm={handleResetConfirm}
      />
    </div>
  );
};
