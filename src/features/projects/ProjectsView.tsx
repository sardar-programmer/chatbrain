import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const ProjectsView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Projects"
        description="Organize your investigations, datasets, notebooks, and models into unified local hubs."
        badge={<HonestBadge variant="sample" label="Mock store" />}
      />

      <EmptyState
        iconName="FolderGit2"
        title="Project workspace"
        description="Project management with 8 domain tabs (Datasets, Conversations, Notebooks, Code, Visualizations, Experiments, Insights, Notes) will activate in Phase U5."
      />
    </div>
  );
};
