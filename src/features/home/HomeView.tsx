import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { HonestBadge } from '../../components/shared/HonestBadge';
import { PageHeader } from '../../components/shared/PageHeader';
import { WORKSPACE_NAV_ITEMS } from '../../config/navigation';
import { useStatus } from '../settings/hooks/useStatus';

export const HomeView: React.FC = () => {
  const { data: status, isError } = useStatus();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const statusLine = useMemo(() => {
    if (isError || !status || status.api !== 'ok') {
      return 'Backend not connected · Demo mode';
    }
    const parts = ['Backend connected'];
    if (status.key_configured) {
      parts.push('Gemini key configured');
      parts.push(`${status.models_count} model${status.models_count === 1 ? '' : 's'}`);
    } else {
      parts.push('Gemini key not configured');
    }
    return parts.join(' · ');
  }, [status, isError]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6">
      <PageHeader
        title={`${getGreeting()}, Architect`}
        description="Pick up where you left off or open an active workspace."
        badge={
          <HonestBadge
            variant={status?.api === 'ok' ? 'demo' : 'disconnected'}
            label={status?.api === 'ok' ? 'Online' : 'Offline'}
          />
        }
        actions={
          <Link
            to="/chat/new"
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors shadow-subtle"
          >
            <Plus className="h-4 w-4" />
            New chat
          </Link>
        }
      />

      <div className="mb-8">
        <h2 className="font-serif text-lg font-medium text-text-primary mb-3">Open a workspace</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {WORKSPACE_NAV_ITEMS.map(item => (
            <Link
              key={item.id}
              to={item.route}
              className="flex flex-col justify-between p-4 rounded-card border border-border bg-surface hover:bg-sidebar-accent transition-colors text-left group"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-accent">
                    {item.group}
                  </span>
                  {item.comingSoon && <HonestBadge variant="soon" />}
                </div>
                <h3 className="font-serif text-base font-medium text-text-primary group-hover:text-accent transition-colors">
                  {item.label}
                </h3>
                <p className="text-xs text-text-secondary mt-1 line-clamp-2 leading-relaxed">
                  {item.blurb}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="text-center py-4 border-t border-border/40 text-xs text-text-tertiary">
        {statusLine} · Local single-user instance
      </div>
    </div>
  );
};
