import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const NotebookView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Interactive Notebook"
        description="Sequential computation combining rich narrative text and executable code cells."
        badge={<HonestBadge variant="disconnected" label="Kernel idle" />}
      />

      <EmptyState
        iconName="BookOpen"
        title="Interactive cell notebook"
        description="Cell list with markdown/code toggling, reordering, and autosave will activate in Phase U4."
      />
    </div>
  );
};
