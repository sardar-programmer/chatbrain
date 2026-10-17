import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const PythonLabView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Python Lab"
        description="Local script editing and offline computational workspace."
        badge={<HonestBadge variant="disconnected" label="Execution not connected yet" />}
      />

      <EmptyState
        iconName="Terminal"
        title="Monaco Python environment"
        description="Offline Monaco Editor with output consoles and AI explain/debug tools will activate in Phase U4."
      />
    </div>
  );
};
