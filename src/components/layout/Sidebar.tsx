import React from 'react';
import {
  PanelLeftClose,
  Plus,
  Search,
  LayoutDashboard,
  History,
  X,
} from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Logo } from '../shared/Logo';
import { SidebarNavGroup } from './SidebarNavGroup';
import { SidebarNavItem } from './SidebarNavItem';
import { SidebarRecents } from './SidebarRecents';
import { DeveloperRow } from './DeveloperRow';
import { ProfileRow } from './ProfileRow';
import { NavTooltip } from './NavTooltip';
import { useUIStore } from '../../state/useUIStore';
import { WORKSPACE_NAV_ITEMS, NavGroup } from '../../config/navigation';

interface SidebarProps {
  isMobileDrawer?: boolean;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileDrawer = false, onNavigate }) => {
  const { sidebarCollapsed, toggleSidebar, setSearchOpen } = useUIStore();

  const isCollapsed = isMobileDrawer ? false : sidebarCollapsed;
  const groups: NavGroup[] = ['Data Science', 'Labs', 'Creative', 'Workspace'];

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
            to="/chat/new"
            icon={Plus}
            label="New chat"
            collapsed={isCollapsed}
            onClick={handleLinkClick}
          />

          {/* Search Trigger */}
          {isCollapsed ? (
            <NavTooltip content="Search (Ctrl+K)">
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(true);
                  handleLinkClick();
                }}
                aria-label="Search (Ctrl+K)"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-text-secondary hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                  <Search className="h-4 w-4 stroke-[1.75] shrink-0" />
                </div>
              </button>
            </NavTooltip>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
                handleLinkClick();
              }}
              aria-label="Search (Ctrl+K)"
              className="flex h-10 w-full items-center rounded-md text-text-secondary hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none shrink-0"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center">
                <Search className="h-4 w-4 stroke-[1.75] shrink-0" />
              </div>
              <div className="flex flex-1 items-center justify-between min-w-0 pr-2">
                <span className="text-xs">Search</span>
                <kbd className="rounded border border-border/70 bg-surface px-1 text-[10px] text-text-tertiary">
                  ⌘K
                </kbd>
              </div>
            </button>
          )}

          {/* Separator between Actions and Core Routes */}
          <div className="mx-1 my-1.5 h-px bg-border/40 shrink-0" role="separator" />

          {/* Core Routes: Dashboard & History */}
          <SidebarNavItem
            to="/"
            end={true}
            icon={LayoutDashboard}
            label="Dashboard"
            collapsed={isCollapsed}
            onClick={handleLinkClick}
          />
          <SidebarNavItem
            to="/history"
            icon={History}
            label="Chat History"
            collapsed={isCollapsed}
            onClick={handleLinkClick}
          />

          {/* Separator before Domain Groups */}
          <div className="mx-1 my-1.5 h-px bg-border/40 shrink-0" role="separator" />

          {/* Domain Groups */}
          <div className="flex flex-col gap-1 shrink-0">
            {groups.map((grp, idx) => (
              <React.Fragment key={grp}>
                {idx > 0 && isCollapsed && (
                  <div className="mx-1 my-1.5 h-px bg-border/40 shrink-0" role="separator" />
                )}
                <SidebarNavGroup
                  group={grp}
                  items={WORKSPACE_NAV_ITEMS.filter(item => item.group === grp)}
                  collapsed={isCollapsed}
                  onNavigate={handleLinkClick}
                />
              </React.Fragment>
            ))}
          </div>

          {/* Recents Section (Only in expanded mode) */}
          {!isCollapsed && (
            <>
              <div className="mx-1 my-1.5 h-px bg-border/40 shrink-0" role="separator" />
              <SidebarRecents collapsed={isCollapsed} onNavigate={handleLinkClick} />
            </>
          )}
        </div>

        {/* Developer entry (only in DEV mode, directly above ProfileRow) */}
        {import.meta.env.DEV && (
          <div className="px-2 shrink-0 border-t border-border/40 py-1">
            <DeveloperRow collapsed={isCollapsed} onNavigate={handleLinkClick} />
          </div>
        )}

        {/* Region 3: Pinned bottom profile row (56px / h-14) */}
        <ProfileRow collapsed={isCollapsed} onNavigate={handleLinkClick} />
      </aside>
    </Tooltip.Provider>
  );
};
