import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const WorkbenchView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Data Science Workbench"
        description="Full lifecycle data science workflow: from raw dataset to final evaluation and documentation."
        badge={<HonestBadge variant="disconnected" label="Pipeline idle" />}
      />

      <EmptyState
        iconName="Workflow"
        title="10-Step Pipeline Stepper"
        description="Dataset → Profile → Clean → EDA → Visualize → Features → Model → Evaluate → Compare → Document layout will be constructed in Phase U3."
      />
    </div>
  );
};
