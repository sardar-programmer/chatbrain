import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
import { ThemeToggle } from '../shared/ThemeToggle';
import { useUIStore } from '../../state/useUIStore';

export const AppShell: React.FC = () => {
  const { toggleSidebar } = useUIStore();

  // Global Ctrl+B / Cmd+B keyboard shortcut to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="flex h-dvh w-screen overflow-hidden bg-background text-text-primary">
      {/* Desktop Sidebar (hidden on < 768px, 56px or 260px on >= 768px) */}
      <Sidebar />

      {/* Main Column Wrapper */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden relative">
        {/* Mobile Slim Header & Drawer */}
        <MobileHeader />

        {/* Desktop Pinned Theme Toggle (Top-right of main content, no background, non-intrusive) */}
        <div className="hidden md:block absolute top-3.5 right-4 z-20 pointer-events-auto">
          <ThemeToggle />
        </div>

        {/* The ONLY scroll container in the entire application */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden focus:outline-none relative"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
