import React, { useMemo, useState } from 'react';
import { Info, Search } from 'lucide-react';
import type { Model } from '../../services/api/types';
import { ModelCard } from './ModelCard';
import { KIND_CHIPS, type KindFilterId, countByKind, filterModels } from './modelFilter';

interface ModelsDiscoveryListProps {
  models: Model[];
  defaultModelId: string | null | undefined;
  onSetDefault: (modelId: string) => void;
  isSettingDefault: boolean;
}

export const ModelsDiscoveryList: React.FC<ModelsDiscoveryListProps> = ({
  models,
  defaultModelId,
  onSetDefault,
  isSettingDefault,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKind, setSelectedKind] = useState<KindFilterId>('chat');

  const counts = useMemo(() => countByKind(models), [models]);
  const filteredModels = useMemo(
    () => filterModels(models, searchQuery, selectedKind),
    [models, searchQuery, selectedKind],
  );

  return (
    <div className="space-y-4">
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

      <div className="space-y-2">
        {filteredModels.length === 0 ? (
          <div className="rounded-card border border-border bg-surface p-8 text-center text-xs text-text-tertiary">
            No models match the filter &ldquo;{selectedKind}&rdquo;{' '}
            {searchQuery && `with query &ldquo;${searchQuery}&rdquo;`}.
          </div>
        ) : (
          filteredModels.map(model => (
            <ModelCard
              key={model.id}
              model={model}
              isDefault={defaultModelId === model.id}
              onSetDefault={onSetDefault}
              isSettingDefault={isSettingDefault}
            />
          ))
        )}
      </div>
    </div>
  );
};
