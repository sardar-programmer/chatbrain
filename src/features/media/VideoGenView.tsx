import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const VideoGenView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Video Generation"
        description="Temporal video synthesis, motion controls, and generation job tracking."
        badge={<HonestBadge variant="disconnected" label="Video engine not connected yet" />}
      />

      <EmptyState
        iconName="Video"
        title="Video Generation Studio"
        description="Text-to-video prompt composition and async job progress viewer will activate in Phase U5."
      />
    </div>
  );
};
