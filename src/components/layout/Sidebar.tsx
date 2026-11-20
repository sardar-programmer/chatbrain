import React from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import { PanelLeftClose, PanelLeftOpen, Plus, Settings, X } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Logo, LogoIcon } from '../shared/Logo';
import { NavTooltip } from './NavTooltip';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarChats } from './SidebarChats';
import { useUIStore } from '../../state/useUIStore';

interface SidebarProps {
  isMobileDrawer?: boolean;
  onNavigate?: () => void;
}

const SafeSidebarChats: React.FC<{ onNavigate?: () => void }> = props => {
  const qc = React.useContext(QueryClientContext);
  if (!qc) {
    return (
      <div className="px-2 py-2 text-xs text-text-tertiary italic">
        Your chats will appear here.
      </div>
    );
  }
  return <SidebarChats {...props} />;
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
        {/* Top Header Row / Logo Cell */}
        <div className="flex shrink-0 items-center justify-center">
          {isMobileDrawer ? (
            <div className="flex w-full items-center justify-between h-10">
              <Logo />
              <button
                type="button"
                onClick={onNavigate}
                aria-label="Close navigation"
                className="rail-btn text-text-tertiary hover:text-text-primary focus:outline-none"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : isCollapsed ? (
            <NavTooltip content="Open sidebar">
              <button
                type="button"
                onClick={toggleSidebar}
                aria-label="Open sidebar"
                className="rail-btn group relative flex h-10 w-10 shrink-0 items-center justify-center focus:outline-none"
              >
                <LogoIcon className="transition-opacity duration-200 group-hover:opacity-0 group-focus-visible:opacity-0" />
                <PanelLeftOpen className="absolute h-5 w-5 stroke-[1.75] text-text-secondary transition-opacity duration-200 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" />
              </button>
            </NavTooltip>
          ) : (
            <div className="flex w-full items-center justify-between h-10">
              <Logo />
              <NavTooltip content="Close sidebar">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Close sidebar"
                  className="rail-btn text-text-tertiary hover:text-text-primary focus:outline-none"
                >
                  <PanelLeftClose className="h-5 w-5 stroke-[1.75]" />
                </button>
              </NavTooltip>
            </div>
          )}
        </div>

        {/* Thin hairline divider under the logo cell */}
        <div className="w-full h-px bg-border/40 my-2 shrink-0" />

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
            <div className="py-2 flex-1 min-h-0 flex flex-col gap-1 overflow-hidden">
              <div className="px-2 py-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                  Chats
                </span>
              </div>
              <SafeSidebarChats onNavigate={handleLinkClick} />
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
