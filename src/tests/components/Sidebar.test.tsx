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

  it('renders expanded mode with labels, headings, developer entry, and collapse button', () => {
    renderSidebar();

    expect(screen.getAllByText('Chat-Brain').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('New chat')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Chat History')).toBeInTheDocument();
    expect(screen.getByText('Data Science')).toBeInTheDocument();
    expect(screen.getByText('Labs')).toBeInTheDocument();
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByLabelText('Collapse sidebar (Ctrl+B)')).toBeInTheDocument();
  });

  it('renders collapsed mode with icons only and no text labels in document', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    renderSidebar();

    // In collapsed mode, expanded-only text labels must not exist
    expect(screen.queryByText('New chat')).toBeNull();
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('Chat History')).toBeNull();
    expect(screen.queryByText('Data Science')).toBeNull();
    expect(screen.queryByText('Labs')).toBeNull();
    expect(screen.queryByText('Developer')).toBeNull();

    // Toggle button should now offer to expand
    expect(screen.getByLabelText('Expand sidebar (Ctrl+B)')).toBeInTheDocument();
    expect(screen.getByLabelText('Search (Ctrl+K)')).toBeInTheDocument();
    expect(screen.getByLabelText('Developer controls (Dev only)')).toBeInTheDocument();
  });

  it('renders group separators between sections and domain groups in collapsed mode', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    renderSidebar();

    // Role separator should be present between sections & domain groups
    const separators = screen.getAllByRole('separator');
    expect(separators.length).toBeGreaterThanOrEqual(4);
  });

  it('enforces strict 40x40 (h-10 w-10 shrink-0) dimensions on collapsed nav links', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    const { container } = renderSidebar();

    const collapsedLinks = container.querySelectorAll('a[href]');
    expect(collapsedLinks.length).toBeGreaterThanOrEqual(5);

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

  it('highlights only the active route in text-primary with subtle background', () => {
    useUIStore.getState().setSidebarCollapsed(true);
    const { container } = renderSidebar({}, '/history');

    const activeLink = container.querySelector('a[href="/history"]');
    expect(activeLink).not.toBeNull();
    expect(activeLink?.className).toContain('text-text-primary');
    expect(activeLink?.className).toContain('bg-sidebar-accent');

    // Dashboard link should NOT be active when on /history
    const dashboardLink = container.querySelector('a[href="/"]');
    expect(dashboardLink).not.toBeNull();
    expect(dashboardLink?.className).toContain('text-text-secondary');
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
