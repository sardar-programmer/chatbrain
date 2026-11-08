import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Sidebar } from '../../components/layout/Sidebar';
import { useUIStore } from '../../state/useUIStore';

const renderSidebar = (props = {}, initialRoute = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <Tooltip.Provider delayDuration={0}>
        <Sidebar {...props} />
      </Tooltip.Provider>
    </MemoryRouter>,
  );
};

describe('Sidebar Architecture & Layout', () => {
  beforeEach(() => {
    useUIStore.getState().setSidebarCollapsed(false);
  });

  it('renders expanded mode with logo, new chat, chats section, settings, and theme toggle', () => {
    renderSidebar();

    expect(screen.getAllByText('Chat-Brain').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('New chat')).toBeInTheDocument();
    expect(screen.getByText('Chats')).toBeInTheDocument();
    expect(screen.getByText('Your chats will appear here.')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Theme')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse sidebar (Ctrl+B)')).toBeInTheDocument();
  });

  it('renders collapsed mode with icons only and hides expanded labels', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    renderSidebar();

    // In collapsed mode, expanded-only text labels must not exist
    expect(screen.queryByText('New chat')).toBeNull();
    expect(screen.queryByText('Chats')).toBeNull();
    expect(screen.queryByText('Your chats will appear here.')).toBeNull();
    expect(screen.queryByText('Settings')).toBeNull();

    // Toggle button should now offer to expand
    expect(screen.getByLabelText('Expand sidebar (Ctrl+B)')).toBeInTheDocument();
  });

  it('enforces strict 40x40 (h-10 w-10 shrink-0) dimensions on collapsed nav links', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    const { container } = renderSidebar();

    const collapsedLinks = container.querySelectorAll('a[href]');
    expect(collapsedLinks.length).toBeGreaterThanOrEqual(2);

    collapsedLinks.forEach(link => {
      expect(link.className).toContain('h-10');
      expect(link.className).toContain('w-10');
      expect(link.className).toContain('shrink-0');
    });
  });

  it('toggles collapsed state on click of the header toggle button', () => {
    renderSidebar();

    const collapseButton = screen.getByLabelText('Collapse sidebar (Ctrl+B)');
    fireEvent.click(collapseButton);

    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it('highlights the active route with sidebar-accent background', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    const { container } = renderSidebar({}, '/settings');

    const activeLink = container.querySelector('a[href="/settings"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink?.className).toContain('text-text-primary');
    expect(activeLink?.className).toContain('bg-sidebar-accent');

    // Home link should NOT be active when on /settings
    const homeLink = container.querySelector('a[href="/"]');
    expect(homeLink).not.toBeNull();
    expect(homeLink?.className).toContain('text-text-secondary');
  });

  it('renders mobile drawer mode as expanded even if sidebarCollapsed is true', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    renderSidebar({ isMobileDrawer: true });

    // In mobile drawer mode, the sidebar must render fully expanded
    expect(screen.getAllByText('Chat-Brain').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('New chat')).toBeInTheDocument();
    expect(screen.getByLabelText('Close navigation')).toBeInTheDocument();
  });
});
