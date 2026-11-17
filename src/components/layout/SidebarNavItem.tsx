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
        collapsed
          ? `rail-btn h-10 w-10 shrink-0 transition-colors focus:outline-none ${
              isActive
                ? 'bg-sidebar-accent text-text-primary font-medium'
                : 'text-text-secondary hover:text-text-primary'
            }`
          : `flex h-10 w-full items-center rounded-[14px] transition-colors focus:outline-none ${
              isActive
                ? 'bg-sidebar-accent text-text-primary font-medium'
                : 'text-text-secondary hover:bg-[var(--g-hover)] hover:text-text-primary'
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
