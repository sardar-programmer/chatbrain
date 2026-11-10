import React from 'react';
import { NavLink } from 'react-router-dom';
import { QueryClientContext, useQuery } from '@tanstack/react-query';
import { MessageSquare, Plus, Settings, X } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Logo } from '../shared/Logo';
import { NavTooltip } from './NavTooltip';
import { SidebarNavItem } from './SidebarNavItem';
import { useUIStore } from '../../state/useUIStore';
import { listConversations } from '../../services/api/client';

interface SidebarProps {
  isMobileDrawer?: boolean;
  onNavigate?: () => void;
}

const SidebarChatsContent: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => listConversations(),
    staleTime: 10_000,
    retry: false,
  });

  const conversations = convData?.items || [];
  if (conversations.length === 0) {
    return (
      <div className="px-2 py-2 text-xs text-text-tertiary italic">
        Your chats will appear here.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      {conversations.map(c => (
        <NavLink
          key={c.id}
          to={`/chat/${c.id}`}
          onClick={onNavigate}
          className={({ isActive }) =>
            `group flex h-9 items-center rounded-lg px-2 text-xs transition-all duration-150 ${
              isActive
                ? 'bg-sidebar-accent text-text-primary font-medium border border-accent/20'
                : 'text-text-secondary hover:bg-sidebar-accent/70 hover:text-text-primary border border-transparent'
            }`
          }
        >
          <MessageSquare className="h-3.5 w-3.5 mr-2 shrink-0 text-text-tertiary group-hover:text-accent transition-colors" />
          <span className="truncate flex-1">{c.title || 'Conversation'}</span>
        </NavLink>
      ))}
    </div>
  );
};

const SidebarChats: React.FC<{ onNavigate?: () => void }> = props => {
  const qc = React.useContext(QueryClientContext);
  if (!qc) {
    return (
      <div className="px-2 py-2 text-xs text-text-tertiary italic">
        Your chats will appear here.
      </div>
    );
  }
  return <SidebarChatsContent {...props} />;
};

export const Sidebar: React.FC<SidebarProps> = ({ isMobileDrawer = false, onNavigate }) => {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const isCollapsed = isMobileDrawer ? false : sidebarCollapsed;

  const handleLinkClick = () => {
    onNavigate?.();
  };

  return (
    <Tooltip.Provider delayDuration={150}>
      <aside
        id={!isMobileDrawer ? 'app-sidebar' : undefined}
        className={`sidebar-transition relative select-none shrink-0 overflow-hidden ${
          isMobileDrawer
            ? 'flex w-full h-full glass-rail p-4 flex-col'
            : 'hidden md:flex glass-rail my-3 ml-3 h-[calc(100dvh-24px)] z-20 px-4 py-4 flex-col'
        }`}
        style={
          !isMobileDrawer
            ? {
                width: isCollapsed ? '72px' : '260px',
                minWidth: isCollapsed ? '72px' : '260px',
                maxWidth: isCollapsed ? '72px' : '260px',
              }
            : undefined
        }
      >
        {/* Top Logo Tile */}
        <div className="flex h-10 items-center justify-center shrink-0 mb-3">
          {isMobileDrawer ? (
            <div className="flex w-full items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={onNavigate}
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : isCollapsed ? (
            <NavTooltip content="Expand sidebar (Ctrl+B)">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Expand sidebar (Ctrl+B)"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-text-secondary hover:text-text-primary transition-colors focus:outline-none"
              >
                <Logo collapsed />
              </button>
            </NavTooltip>
          ) : (
            <div className="flex w-full items-center justify-between">
              <NavTooltip content="Collapse sidebar (Ctrl+B)">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar (Ctrl+B)"
                  className="flex items-center gap-2 rounded-xl text-text-primary hover:text-accent transition-colors focus:outline-none"
                >
                  <Logo />
                </button>
              </NavTooltip>
            </div>
          )}
        </div>

        {/* Navigation Area */}
        <div
          className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden flex flex-col gap-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* New Chat (+) Button */}
          <SidebarNavItem
            to="/"
            end
            icon={Plus}
            label="New chat"
            tooltipText="New chat"
            collapsed={isCollapsed}
            onClick={handleLinkClick}
          />

          {/* Chats Section when expanded */}
          {!isCollapsed && (
            <div className="py-2 flex flex-col gap-1">
              <div className="px-2 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Chats
                </span>
              </div>
              <SidebarChats onNavigate={handleLinkClick} />
            </div>
          )}
        </div>

        {/* Bottom Pinned Settings Button */}
        <div className="pt-2 flex flex-col gap-1 shrink-0">
          <SidebarNavItem
            to="/settings"
            icon={Settings}
            label="Settings"
            tooltipText="Settings"
            collapsed={isCollapsed}
            onClick={handleLinkClick}
          />
        </div>
      </aside>
    </Tooltip.Provider>
  );
};
