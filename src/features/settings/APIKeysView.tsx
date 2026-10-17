import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { SectionCard } from '../../components/shared/SectionCard';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const APIKeysView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="API Management"
        description="Configure API access keys for model discovery and generation. Keys are stored strictly on this machine."
        badge={<HonestBadge variant="disconnected" label="Not connected yet" />}
      />

      <SectionCard
        title="Google Gemini API Key"
        description="Write-only key input. Saved keys are never echoed back to the UI."
      >
        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Enter API Key
            </label>
            <input
              type="password"
              placeholder="AIzaSy..."
              className="w-full rounded-md border border-border bg-sidebar px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
            >
              Save Key
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-sidebar-accent transition-colors"
            >
              Test Connection
            </button>
          </div>

          <div className="rounded-md bg-sidebar/70 p-3 text-xs text-text-secondary leading-relaxed border border-border/50">
            <strong>Security note:</strong> This application is 100% local. Your API keys are never
            sent to any third-party server, cloud proxy, or analytics service.
          </div>
        </div>
      </SectionCard>
    </div>
  );
};
