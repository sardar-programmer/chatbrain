import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const ImageGenView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Image Generation"
        description="Prompt composer, aspect ratio controls, and local creative diffusion pipeline."
        badge={<HonestBadge variant="disconnected" label="Image engine not connected yet" />}
      />

      <EmptyState
        iconName="Image"
        title="Image Generation Studio"
        description="Async-job state UI (queued, running, progress, done, failed) and sample generation showcases will activate in Phase U5."
      />
    </div>
  );
};
