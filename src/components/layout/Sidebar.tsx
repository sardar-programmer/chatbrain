import React from 'react';
import { PanelLeftClose, Plus, Settings, X } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Logo } from '../shared/Logo';
import { ThemeToggle } from '../shared/ThemeToggle';
import { NavTooltip } from './NavTooltip';
import { SidebarNavItem } from './SidebarNavItem';
import { useUIStore } from '../../state/useUIStore';

interface SidebarProps {
  isMobileDrawer?: boolean;
  onNavigate?: () => void;
}

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
        className={`sidebar-transition relative h-full flex-col bg-sidebar select-none shrink-0 overflow-hidden ${
          isMobileDrawer ? 'flex w-full' : 'hidden md:flex'
        }`}
        style={
          !isMobileDrawer
            ? {
                width: isCollapsed ? '56px' : '260px',
                minWidth: isCollapsed ? '56px' : '260px',
                maxWidth: isCollapsed ? '56px' : '260px',
              }
            : undefined
        }
      >
        {/* Region 1: Fixed-height brand/header (56px / h-14) */}
        <div className="flex h-14 items-center px-2 border-b border-border/40 shrink-0">
          {isMobileDrawer ? (
            <div className="flex w-full items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={onNavigate}
                aria-label="Close navigation"
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none shrink-0 mr-1"
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
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none"
              >
                <Logo collapsed />
              </button>
            </NavTooltip>
          ) : (
            <div className="flex w-full items-center justify-between">
              <Logo />
              <NavTooltip content="Collapse sidebar (Ctrl+B)">
                <button
                  type="button"
                  onClick={toggleSidebar}
                  aria-label="Collapse sidebar (Ctrl+B)"
                  className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none shrink-0 mr-1"
                >
                  <PanelLeftClose className="h-4 w-4 stroke-[1.75]" />
                </button>
              </NavTooltip>
            </div>
          )}
        </div>

        {/* Region 2: Independently scrollable navigation body */}
        <div
          className="sidebar-nav-scroll flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-2 flex flex-col gap-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {/* New Chat Primary Action */}
          <SidebarNavItem
            to="/"
            end
            icon={Plus}
            label="New chat"
            collapsed={isCollapsed}
            onClick={handleLinkClick}
          />

          {/* Chats Section */}
          {!isCollapsed && (
            <div className="py-2">
              <div className="px-3 py-1">
                <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">
                  Chats
                </span>
              </div>
              <div className="px-3 py-2 text-xs text-text-tertiary italic">
                Your chats will appear here.
              </div>
            </div>
          )}
        </div>

        {/* Region 3: Pinned bottom Settings link & Theme toggle */}
        <div className="border-t border-border/40 p-2 flex flex-col gap-1 shrink-0">
          <SidebarNavItem
            to="/settings"
            icon={Settings}
            label="Settings"
            collapsed={isCollapsed}
            onClick={handleLinkClick}
          />

          {isCollapsed ? (
            <NavTooltip content="Toggle theme">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <ThemeToggle className="flex h-10 w-10 items-center justify-center rounded-md text-text-secondary hover:bg-sidebar-accent hover:text-text-primary transition-colors" />
              </div>
            </NavTooltip>
          ) : (
            <div className="flex h-10 w-full items-center justify-between rounded-md px-3 text-text-secondary hover:bg-sidebar-accent hover:text-text-primary transition-colors">
              <span className="text-xs font-medium">Theme</span>
              <ThemeToggle />
            </div>
          )}
        </div>
      </aside>
    </Tooltip.Provider>
  );
};
