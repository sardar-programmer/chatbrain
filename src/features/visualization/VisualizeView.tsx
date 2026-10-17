import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const VisualizeView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Visualization Studio"
        description="Craft exploratory data visualizations with responsive cartesian plots."
        badge={<HonestBadge variant="sample" label="Offline cartesian" />}
      />

      <EmptyState
        iconName="BarChart3"
        title="Plotly charting engine"
        description="Lazy-loaded cartesian bundle with 9 chart types (scatter, line, bar, histogram, box, etc.) will activate in Phase U3."
      />
    </div>
  );
};
