import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const ModelsView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Models"
        description="Discovered models, supported capabilities, context windows, and status indicators."
        badge={<HonestBadge variant="disconnected" label="0 models discovered" />}
      />

      <EmptyState
        iconName="Boxes"
        title="No models discovered yet"
        description="Connect an API key in API Management to discover and query models. Never presenting static fake model lists."
      />
    </div>
  );
};
