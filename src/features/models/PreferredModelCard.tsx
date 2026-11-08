import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { SectionCard } from '../../components/shared/SectionCard';
import type { DefaultModel, Model } from '../../services/api/types';

interface PreferredModelCardProps {
  defaultModelStatus: DefaultModel | null | undefined;
  defaultModelObj: Model | null;
  onClearDefault: () => void;
  isClearing: boolean;
}

export const PreferredModelCard: React.FC<PreferredModelCardProps> = ({
  defaultModelStatus,
  defaultModelObj,
  onClearDefault,
  isClearing,
}) => {
  const modelId = defaultModelStatus?.model_id;
  const isValid = defaultModelStatus?.valid;
  const reason = defaultModelStatus?.reason;

  return (
    <SectionCard
      title="Preferred model (optional)"
      description="Tried first when available. If it is busy or unavailable, Chat-Brain switches automatically. You can leave this empty and let Chat-Brain pick the fastest."
      noPadding
      className="p-5"
    >
      {modelId ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-serif text-base font-medium text-text-primary">
                {defaultModelObj?.display_name || modelId}
              </span>
              <code className="rounded bg-sidebar px-1.5 py-0.5 text-xs font-mono text-text-secondary border border-border/50">
                {modelId}
              </code>
              {isValid ? (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-status-success/10 text-status-success border border-status-success/20">
                  Active Preferred
                </span>
              ) : (
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-pill bg-status-warning/10 text-status-warning border border-status-warning/20">
                  Invalid ({reason || 'issue'})
                </span>
              )}
            </div>
            {!isValid && (
              <p className="text-xs text-status-warning">
                Warning:{' '}
                {reason === 'model_not_found'
                  ? 'This model is no longer present in your discovered models list.'
                  : reason === 'not_a_chat_model'
                    ? 'This model does not report normal chat/text generation capabilities.'
                    : 'Please choose an active chat model from the list below.'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClearDefault}
            disabled={isClearing}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-sidebar-accent transition-colors shrink-0 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Clear preferred
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-xs text-text-secondary py-1">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            No preferred model selected. Chat-Brain will automatically route to the fastest available chat model.
          </span>
        </div>
      )}
    </SectionCard>
  );
};
