import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const DatasetsView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Dataset Analyzer"
        description="Inspect schemas, missing values, distributions, and correlation matrices on local datasets."
        badge={<HonestBadge variant="sample" label="Sample dataset" />}
      />

      <EmptyState
        iconName="Database"
        title="Dataset analyzer workspace"
        description="Virtualized data preview, summary statistics, and correlation heatmaps will activate in Phase U3."
      />
    </div>
  );
};
