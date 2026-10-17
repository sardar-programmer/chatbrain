import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavTooltip } from './NavTooltip';

interface SidebarNavItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tooltipText?: string;
  collapsed: boolean;
  comingSoon?: boolean;
  end?: boolean;
  onClick?: () => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  to,
  icon: Icon,
  label,
  tooltipText,
  collapsed,
  comingSoon,
  end = false,
  onClick,
}) => {
  const content = (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex h-10 items-center rounded-md transition-colors focus:outline-none shrink-0 ${
          collapsed ? 'w-10 justify-center' : 'w-full'
        } ${
          isActive
            ? 'bg-sidebar-accent text-text-primary font-medium'
            : 'text-text-secondary hover:bg-sidebar-accent hover:text-text-primary'
        }`
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4 stroke-[1.75] shrink-0" />
      </div>
      {!collapsed && (
        <div className="flex flex-1 items-center justify-between min-w-0 pr-2">
          <span className="truncate text-xs">{label}</span>
          {comingSoon && (
            <span className="rounded bg-text-tertiary/15 px-1 py-0.2 text-[9px] text-text-tertiary uppercase shrink-0">
              Soon
            </span>
          )}
        </div>
      )}
    </NavLink>
  );

  if (collapsed) {
    return <NavTooltip content={tooltipText || label}>{content}</NavTooltip>;
  }

  return content;
};
