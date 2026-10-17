import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const MediaLibraryView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Media Library"
        description="Unified gallery of all generated visuals, videos, and uploaded assets."
        badge={<HonestBadge variant="sample" label="Local media" />}
      />

      <EmptyState
        iconName="Film"
        title="Media Library"
        description="Grid of images, videos, and uploads with type filters, sort, preview drawers, and export actions will activate in Phase U5."
      />
    </div>
  );
};
