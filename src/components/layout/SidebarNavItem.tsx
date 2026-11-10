import React from 'react';
import { NavLink } from 'react-router-dom';
import { NavTooltip } from './NavTooltip';

interface SidebarNavItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tooltipText?: string;
  collapsed: boolean;
  end?: boolean;
  onClick?: () => void;
}

export const SidebarNavItem: React.FC<SidebarNavItemProps> = ({
  to,
  icon: Icon,
  label,
  tooltipText,
  collapsed,
  end = false,
  onClick,
}) => {
  const content = (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex h-10 items-center rounded-lg transition-all duration-150 focus:outline-none shrink-0 ${
          collapsed ? 'w-10 justify-center' : 'w-full'
        } ${
          isActive
            ? 'bg-sidebar-accent text-text-primary font-medium shadow-sm border border-accent/15'
            : 'text-text-secondary hover:bg-sidebar-accent/80 hover:text-text-primary border border-transparent'
        }`
      }
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center">
        <Icon className="h-4 w-4 stroke-[1.75] shrink-0" />
      </div>
      {!collapsed && (
        <div className="flex flex-1 items-center justify-between min-w-0 pr-2">
          <span className="truncate text-xs">{label}</span>
        </div>
      )}
    </NavLink>
  );

  if (collapsed) {
    return <NavTooltip content={tooltipText || label}>{content}</NavTooltip>;
  }

  return content;
};
