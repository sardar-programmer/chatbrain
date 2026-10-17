import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { SectionCard } from '../../components/shared/SectionCard';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const StatusView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6 space-y-6">
      <PageHeader
        title="System Status"
        description="Local environment diagnostics, API connectivity, and engine health."
        badge={<HonestBadge variant="disconnected" label="Offline mode" />}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SectionCard title="API Connection" noPadding className="p-4">
          <div className="flex items-center gap-2 mt-1">
            <span className="h-2 w-2 rounded-full bg-status-warning" />
            <span className="text-xs font-medium text-text-primary">Not Connected</span>
          </div>
          <p className="text-[11px] text-text-tertiary mt-1">Configure key in API Management</p>
        </SectionCard>

        <SectionCard title="Models Discovered" noPadding className="p-4">
          <div className="text-lg font-serif font-medium text-text-primary mt-1">0</div>
          <p className="text-[11px] text-text-tertiary mt-1">No models registered yet</p>
        </SectionCard>

        <SectionCard title="Last Request" noPadding className="p-4">
          <div className="text-xs font-mono text-text-secondary mt-1">None</div>
          <p className="text-[11px] text-text-tertiary mt-1">Zero network telemetry sent</p>
        </SectionCard>
      </div>

      <SectionCard title="Local Diagnostic Log" description="Recent client errors and warnings">
        <div className="rounded-md bg-sidebar p-3 font-mono text-xs text-text-tertiary">
          [System Ready] Single-user environment initialized. No client runtime errors logged.
        </div>
      </SectionCard>
    </div>
  );
};
