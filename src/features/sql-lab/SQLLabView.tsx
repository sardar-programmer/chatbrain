import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const SQLLabView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="SQL Lab"
        description="Query local sqlite tables, inspect schema trees, and test analytical SQL."
        badge={<HonestBadge variant="disconnected" label="Query engine not connected yet" />}
      />

      <EmptyState
        iconName="Table2"
        title="SQL query editor"
        description="Monaco SQL editor, schema explorer, and query history will activate in Phase U4."
      />
    </div>
  );
};
