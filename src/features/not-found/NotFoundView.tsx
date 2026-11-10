import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, MessageSquare } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl border border-white/70 dark:border-white/10 bg-surface/70 dark:bg-surface/40 backdrop-blur-xl text-accent mb-4 shadow-sm">
        <div className="absolute inset-0 rounded-2xl bg-accent/20 blur-md pointer-events-none" />
        <Compass className="h-7 w-7 stroke-[1.75] relative z-10" />
      </div>

      <h1 className="font-serif text-3xl font-medium text-text-primary mb-2">Page not found</h1>
      <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
        The workspace or resource you requested does not exist or has been moved.
      </p>

      <Link
        to="/"
        className="btn-orange-gradient inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-medium text-white shadow-sm"
      >
        <MessageSquare className="h-4 w-4" />
        Back to Chat
      </Link>
    </div>
  );
};
