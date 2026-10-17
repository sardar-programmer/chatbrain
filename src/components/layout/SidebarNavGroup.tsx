import React from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { NavItem, NavGroup } from '../../config/navigation';
import { useUIStore } from '../../state/useUIStore';
import { getIcon } from '../shared/IconRegistry';
import { SidebarNavItem } from './SidebarNavItem';

interface SidebarNavGroupProps {
  group: NavGroup;
  items: NavItem[];
  collapsed: boolean;
  onNavigate?: () => void;
}

export const SidebarNavGroup: React.FC<SidebarNavGroupProps> = ({
  group,
  items,
  collapsed,
  onNavigate,
}) => {
  const { sidebarGroups, toggleSidebarGroup } = useUIStore();
  const location = useLocation();

  const hasActiveRoute = items.some(item => location.pathname === item.route);
  const isOpen = sidebarGroups[group] ?? hasActiveRoute;

  if (collapsed) {
    return (
      <div className="flex flex-col gap-1 w-full shrink-0">
        {items.map(item => (
          <SidebarNavItem
            key={item.id}
            to={item.route}
            icon={getIcon(item.iconName)}
            label={item.label}
            tooltipText={`${item.label} · ${group}`}
            collapsed={true}
            onClick={onNavigate}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="py-1 select-none shrink-0">
      <button
        type="button"
        onClick={() => toggleSidebarGroup(group)}
        className="flex w-full items-center justify-between px-2 py-1.5 text-[11px] font-medium uppercase tracking-wider text-text-tertiary hover:text-text-secondary transition-colors focus:outline-none"
      >
        <span>{group}</span>
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 stroke-[2] shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 stroke-[2] shrink-0" />
        )}
      </button>

      {isOpen && (
        <div className="mt-0.5 flex flex-col gap-1">
          {items.map(item => (
            <SidebarNavItem
              key={item.id}
              to={item.route}
              icon={getIcon(item.iconName)}
              label={item.label}
              collapsed={false}
              comingSoon={item.comingSoon}
              onClick={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};
