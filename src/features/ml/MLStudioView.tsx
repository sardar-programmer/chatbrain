import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const MLStudioView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="ML Studio"
        description="Machine learning experiment tracking, model comparison, and hyperparameter tuning."
        badge={<HonestBadge variant="disconnected" label="Training not connected yet" />}
      />

      <EmptyState
        iconName="Cpu"
        title="Machine Learning Studio"
        description="Task selection (Regression, Classification, Clustering, PCA) and sample experiment metrics will activate in Phase U4."
      />
    </div>
  );
};
