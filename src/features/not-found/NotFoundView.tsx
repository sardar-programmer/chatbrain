import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';

export const NotFoundView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-card bg-accent-soft text-accent mb-4">
        <Compass className="h-7 w-7 stroke-[1.75]" />
      </div>

      <h1 className="font-serif text-3xl font-medium text-text-primary mb-2">Page not found</h1>
      <p className="text-sm text-text-secondary max-w-sm mb-6 leading-relaxed">
        The workspace or resource you requested does not exist or has been moved.
      </p>

      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-accent-foreground hover:bg-accent-hover transition-colors"
      >
        <Home className="h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  );
};
