import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const DSChatView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Data Science Chat"
        description="Contextual AI assistance for data analysis, pandas cleaning, statistics, and ML exploration."
        badge={<HonestBadge variant="sample" label="Sample context" />}
      />

      <EmptyState
        iconName="Sparkles"
        title="Data Science workspace ready"
        description="Structured cards (Observed, Inferred, Suggested, Unknown) and dataset context linking will activate in Phase U3."
      />
    </div>
  );
};
