import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { MessageSquare, ArrowLeft } from 'lucide-react';
import { EmptyState } from '../../components/shared/EmptyState';

export const ChatView: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Chat
        </Link>
      </div>

      <EmptyState
        iconName="MessageSquare"
        title={`Conversation ${id || ''}`}
        description="Active chat stream and message history will be fully powered by the local backend in M1.4."
        action={
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
          >
            <MessageSquare className="h-4 w-4" />
            Start new conversation
          </Link>
        }
      />
    </div>
  );
};
