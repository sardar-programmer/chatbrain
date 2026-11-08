import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Menu, Plus } from 'lucide-react';
import { Logo } from '../shared/Logo';
import { Sidebar } from './Sidebar';
import { useUIStore } from '../../state/useUIStore';

export const MobileHeader: React.FC = () => {
  const { mobileDrawerOpen, setMobileDrawerOpen } = useUIStore();

  // Handle Escape key to close mobile drawer
  useEffect(() => {
    if (!mobileDrawerOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileDrawerOpen, setMobileDrawerOpen]);

  // Prevent background page scrolling while the mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [mobileDrawerOpen]);

  return (
    <>
      {/* Slim Top Bar for viewports < 768px (safe-area aware) */}
      <header className="md:hidden flex h-13 w-full items-center justify-between px-3 border-b border-border bg-sidebar shrink-0 z-30 select-none pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-secondary hover:bg-sidebar-accent transition-colors focus:outline-none"
        >
          <Menu className="h-5 w-5 stroke-[1.75]" />
        </button>

        <Logo />

        <Link
          to="/"
          aria-label="New chat"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-accent-soft text-accent transition-colors focus:outline-none"
        >
          <Plus className="h-5 w-5 stroke-[2]" />
        </Link>
      </header>

      {/* Mobile Drawer Overlay */}
      {mobileDrawerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation drawer"
          className="md:hidden fixed inset-0 z-50 flex"
        >
          {/* Backdrop with click-to-dismiss */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-200"
            onClick={() => setMobileDrawerOpen(false)}
            aria-hidden="true"
          />

          {/* Drawer Panel */}
          <div className="relative flex w-[280px] max-w-[85vw] flex-col bg-sidebar h-dvh shadow-2xl z-10 animate-in slide-in-from-left duration-200 overflow-hidden pb-[env(safe-area-inset-bottom)]">
            <Sidebar isMobileDrawer onNavigate={() => setMobileDrawerOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
};
