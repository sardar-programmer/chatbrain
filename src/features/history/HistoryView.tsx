import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { PageHeader } from '../../components/shared/PageHeader';
import { EmptyState } from '../../components/shared/EmptyState';

export const HistoryView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title="Chat History"
        description="Search and manage your saved conversations."
        actions={
          <Link
            to="/chat/new"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Link>
        }
      />

      <EmptyState
        iconName="History"
        title="Your saved conversations will appear here"
        description="Every conversation with simulated responses or local notes is stored securely on this machine."
        action={
          <Link
            to="/chat/new"
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-4 py-2 text-xs font-medium text-text-primary hover:bg-sidebar-accent transition-colors"
          >
            Start a conversation
          </Link>
        }
      />
    </div>
  );
};
