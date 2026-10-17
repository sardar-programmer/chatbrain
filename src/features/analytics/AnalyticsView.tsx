import React from 'react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';
import { HonestBadge } from '../../components/shared/HonestBadge';

export const AnalyticsView: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Analytics & Usage"
        description="Computed metrics, token estimations, and session statistics from local chats."
        badge={<HonestBadge variant="sample" label="Mock metrics" />}
      />

      <EmptyState
        iconName="LineChart"
        title="Personal Analytics"
        description="Activity charts, token metrics, model usage breakdowns, and request success rates will activate in Phase U6."
      />
    </div>
  );
};
