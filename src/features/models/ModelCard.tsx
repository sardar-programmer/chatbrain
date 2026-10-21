import React from 'react';
import { Check, Sparkles } from 'lucide-react';
import type { Model } from '../../services/api/types';

interface ModelCardProps {
  model: Model;
  isDefault: boolean;
  onSetDefault: (modelId: string) => void;
  isSettingDefault: boolean;
}

export function formatTokens(num: number | null): string {
  if (num == null) return '—';
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(num % 1_000_000 === 0 ? 0 : 1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(num % 1_000 === 0 ? 0 : 1)}k`;
  return num.toLocaleString();
}

export const ModelCard: React.FC<ModelCardProps> = ({
  model,
  isDefault,
  onSetDefault,
  isSettingDefault,
}) => {
  const isChat = model.kind === 'chat';

  return (
    <div
      className={`rounded-card border p-4 transition-all duration-150 ${
        isDefault
          ? 'border-accent bg-accent-soft/20 shadow-subtle'
          : 'border-border bg-surface hover:border-border/80'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-serif text-sm font-medium text-text-primary">
              {model.display_name}
            </span>
            <code className="rounded bg-sidebar px-1.5 py-0.5 text-[11px] font-mono text-text-secondary border border-border/50">
              {model.id}
            </code>

            {/* Kind Badge */}
            <span
              className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded-pill bg-sidebar text-accent border border-accent/20"
              title={model.kind_inferred ? 'Functional kind inferred from name' : 'Determined from reported actions'}
            >
              {model.kind}
              {model.kind_inferred && (
                <span className="ml-1 text-[9px] text-text-tertiary lowercase font-normal italic">
                  (inferred)
                </span>
              )}
            </span>

            {isDefault && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-pill bg-accent text-white">
                <Check className="h-3 w-3" />
                Default
              </span>
            )}
          </div>

          {/* Capabilities & Token Limits */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-text-tertiary">
            <div className="flex items-center gap-1">
              <span>Tokens:</span>
              <span className="font-mono text-text-secondary">
                {formatTokens(model.input_token_limit)} in / {formatTokens(model.output_token_limit)} out
              </span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <span>Capabilities:</span>
              {model.capabilities.map((cap, idx) => (
                <span
                  key={idx}
                  className="rounded bg-sidebar px-1.5 py-0.2 text-[10px] text-text-secondary border border-border/40"
                >
                  {cap}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="shrink-0 flex items-center gap-2">
          {isChat ? (
            <button
              type="button"
              onClick={() => onSetDefault(model.id)}
              disabled={isDefault || isSettingDefault}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                isDefault
                  ? 'bg-accent/15 text-accent cursor-default'
                  : 'border border-border bg-surface text-text-primary hover:bg-sidebar-accent'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isDefault ? 'Current default' : 'Set as default'}
            </button>
          ) : (
            <button
              type="button"
              disabled
              title="Only models classified as 'chat' can be set as default"
              className="inline-flex items-center rounded-md border border-border/50 bg-sidebar/50 px-3 py-1.5 text-xs font-medium text-text-tertiary cursor-not-allowed opacity-60"
            >
              Not a chat model
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
