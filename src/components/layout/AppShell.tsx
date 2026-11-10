import React, { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { MobileHeader } from './MobileHeader';
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
    <div className="flex h-dvh w-screen overflow-hidden bg-transparent text-text-primary relative selection:bg-accent/20">
      {/* Static CSS page background */}
      <div className="app-bg" aria-hidden="true" />

      {/* Desktop Floating Glass Sidebar Rail */}
      <Sidebar />

      {/* Main Column Wrapper */}
      <div className="flex flex-1 flex-col h-full min-w-0 overflow-hidden relative z-10 bg-transparent">
        {/* Mobile Slim Header & Drawer */}
        <MobileHeader />

        {/* The ONLY scroll container in the entire application */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden focus:outline-none relative bg-transparent"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};
