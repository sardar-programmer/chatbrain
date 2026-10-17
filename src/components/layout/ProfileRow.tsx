import React from 'react';
import { useNavigate } from 'react-router-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Settings,
  Boxes,
  KeyRound,
  LineChart,
  Sun,
  Moon,
  Monitor,
  Activity,
  MoreVertical,
} from 'lucide-react';
import { useUIStore, ThemeMode } from '../../state/useUIStore';
import { NavTooltip } from './NavTooltip';

interface ProfileRowProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

export const ProfileRow: React.FC<ProfileRowProps> = ({ collapsed, onNavigate }) => {
  const { theme, setTheme } = useUIStore();
  const navigate = useNavigate();

  const handleSelectRoute = (route: string) => {
    navigate(route);
    onNavigate?.();
  };

  const trigger = (
    <DropdownMenu.Trigger asChild>
      <button
        type="button"
        aria-label="User Profile & Settings"
        className={`flex h-10 items-center rounded-md transition-colors focus:outline-none shrink-0 text-text-primary hover:bg-sidebar-accent ${
          collapsed ? 'w-10 justify-center' : 'w-full'
        }`}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-accent text-[11px] font-semibold text-white">
            CB
          </div>
        </div>
        {!collapsed && (
          <div className="flex flex-1 items-center justify-between min-w-0 pr-2">
            <span className="truncate font-medium text-xs text-text-primary">Chat-Brain</span>
            <MoreVertical className="h-3.5 w-3.5 text-text-tertiary shrink-0" />
          </div>
        )}
      </button>
    </DropdownMenu.Trigger>
  );

  return (
    <div className="border-t border-border/40 px-2 flex h-14 items-center shrink-0">
      <DropdownMenu.Root>
        {collapsed ? (
          <NavTooltip content="Chat-Brain · Profile & Settings">{trigger}</NavTooltip>
        ) : (
          trigger
        )}

        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align={collapsed ? 'start' : 'start'}
            sideOffset={8}
            className="z-50 w-56 rounded-md border border-border bg-surface p-1 shadow-lg text-xs animate-in fade-in"
          >
            <DropdownMenu.Item
              onSelect={() => handleSelectRoute('/settings')}
              className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-text-secondary hover:bg-sidebar-accent hover:text-text-primary cursor-pointer outline-none"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Settings</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => handleSelectRoute('/models')}
              className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-text-secondary hover:bg-sidebar-accent hover:text-text-primary cursor-pointer outline-none"
            >
              <Boxes className="h-3.5 w-3.5" />
              <span>Models</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => handleSelectRoute('/api-keys')}
              className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-text-secondary hover:bg-sidebar-accent hover:text-text-primary cursor-pointer outline-none"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>API Management</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => handleSelectRoute('/analytics')}
              className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-text-secondary hover:bg-sidebar-accent hover:text-text-primary cursor-pointer outline-none"
            >
              <LineChart className="h-3.5 w-3.5" />
              <span>Analytics</span>
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={() => handleSelectRoute('/status')}
              className="flex items-center gap-2.5 rounded px-2.5 py-1.5 text-text-secondary hover:bg-sidebar-accent hover:text-text-primary cursor-pointer outline-none"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>System Status</span>
            </DropdownMenu.Item>

            <DropdownMenu.Separator className="my-1 h-px bg-border" />

            <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
              Theme
            </div>
            {(['light', 'dark', 'system'] as ThemeMode[]).map(mode => (
              <DropdownMenu.Item
                key={mode}
                onSelect={() => setTheme(mode)}
                className={`flex items-center justify-between rounded px-2.5 py-1.5 cursor-pointer outline-none ${
                  theme === mode
                    ? 'bg-sidebar-accent text-accent font-medium'
                    : 'text-text-secondary hover:bg-sidebar-accent hover:text-text-primary'
                }`}
              >
                <div className="flex items-center gap-2">
                  {mode === 'light' && <Sun className="h-3.5 w-3.5" />}
                  {mode === 'dark' && <Moon className="h-3.5 w-3.5" />}
                  {mode === 'system' && <Monitor className="h-3.5 w-3.5" />}
                  <span className="capitalize">{mode}</span>
                </div>
                {theme === mode && <span className="text-[10px] text-accent">✓</span>}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
};
