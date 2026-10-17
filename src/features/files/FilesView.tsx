import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const FilesView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Files"
        description="Unified local workspace file explorer and asset inspector."
        badge={<HonestBadge variant="sample" label="Local files" />}
      />

      <EmptyState
        iconName="FolderOpen"
        title="Workspace file manager"
        description="Filter by type, inspect file sizes, preview metadata, and organize assets in Phase U5."
      />
    </div>
  );
};
