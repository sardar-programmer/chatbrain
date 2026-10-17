import React from 'react';
import { NavLink, Link } from 'react-router-dom';
import { MessageSquare, Pin } from 'lucide-react';
import { APP_LIMITS } from '../../config/constants';

interface RecentChat {
  id: string;
  title: string;
  pinned?: boolean;
}

interface SidebarRecentsProps {
  collapsed: boolean;
  recents?: RecentChat[];
  totalCount?: number;
  onNavigate?: () => void;
}

export const SidebarRecents: React.FC<SidebarRecentsProps> = ({
  collapsed,
  recents = [],
  totalCount = 0,
  onNavigate,
}) => {
  if (collapsed) return null;

  const displayList = recents.slice(0, APP_LIMITS.MAX_SIDEBAR_RECENTS);
  const showViewAll = totalCount > APP_LIMITS.MAX_SIDEBAR_RECENTS;

  return (
    <div className="py-2">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
          Recents
        </span>
        {showViewAll && (
          <Link
            to="/history"
            onClick={onNavigate}
            className="text-[11px] text-accent hover:text-accent-hover transition-colors"
          >
            View all
          </Link>
        )}
      </div>

      {displayList.length === 0 ? (
        <div className="px-3 py-2 text-xs text-text-tertiary italic">
          Your chats will appear here.
        </div>
      ) : (
        <div className="space-y-0.5 mt-0.5">
          {displayList.map(chat => (
            <NavLink
              key={chat.id}
              to={`/chat/${chat.id}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center justify-between rounded-md px-3 py-1.5 text-xs text-text-secondary hover:bg-sidebar-accent hover:text-text-primary transition-colors ${
                  isActive ? 'bg-sidebar-accent text-accent font-medium' : ''
                }`
              }
            >
              <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span className="truncate">{chat.title}</span>
              </div>
              {chat.pinned && <Pin className="h-3 w-3 shrink-0 text-accent rotate-45" />}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
};
