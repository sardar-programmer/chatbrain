import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const MemoryView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Memory"
        description="Personal AI knowledge base, preferences, facts, and persistent instructions."
        badge={<HonestBadge variant="sample" label="Local memory" />}
      />

      <EmptyState
        iconName="BrainCircuit"
        title="Personal Memory Bank"
        description="Manage memory tags, custom instructions, and export/import memories as JSON in Phase U5."
      />
    </div>
  );
};
