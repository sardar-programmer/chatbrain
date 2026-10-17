import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Search, Sparkles, Folder, Database, Terminal, ArrowRight } from 'lucide-react';
import { useUIStore } from '../../state/useUIStore';
import { ALL_NAV_ITEMS } from '../../config/navigation';

export const SearchPalette: React.FC = () => {
  const { searchOpen, setSearchOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Handle global Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  // Filter items based on query
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ALL_NAV_ITEMS.slice(0, 8);
    return ALL_NAV_ITEMS.filter(
      item => item.label.toLowerCase().includes(q) || item.blurb.toLowerCase().includes(q),
    );
  }, [query]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  const handleSelect = (route: string) => {
    setSearchOpen(false);
    navigate(route);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(
        prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length),
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex].route);
      }
    }
  };

  const getItemIcon = (group?: string) => {
    switch (group) {
      case 'Data Science':
        return <Database className="h-4 w-4 text-accent" />;
      case 'Labs':
        return <Terminal className="h-4 w-4 text-status-info" />;
      case 'Workspace':
        return <Folder className="h-4 w-4 text-status-warning" />;
      default:
        return <Sparkles className="h-4 w-4 text-text-secondary" />;
    }
  };

  return (
    <DialogPrimitive.Root open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] animate-in fade-in" />
        <DialogPrimitive.Content
          onKeyDown={handleKeyDown}
          className="fixed left-[50%] top-[20%] z-50 w-full max-w-xl -translate-x-1/2 overflow-hidden rounded-card border border-border bg-surface shadow-xl duration-200 animate-in fade-in zoom-in-95"
        >
          <div className="flex items-center border-b border-border px-4 py-3">
            <Search className="h-4 w-4 text-text-tertiary mr-3 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search workspaces, tools, chats, settings... (Ctrl+K)"
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
              autoFocus
            />
            <kbd className="hidden sm:inline-block rounded border border-border bg-sidebar px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary">
              ESC
            </kbd>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filteredItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-text-tertiary">
                No matching tools or workspaces found
              </div>
            ) : (
              <div className="space-y-1">
                {filteredItems.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.route)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        isSelected
                          ? 'bg-sidebar-accent text-text-primary'
                          : 'text-text-secondary hover:bg-sidebar-accent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        {getItemIcon(item.group)}
                        <span className="font-medium truncate">{item.label}</span>
                        {item.group && (
                          <span className="text-[11px] text-text-tertiary">· {item.group}</span>
                        )}
                      </div>
                      <ArrowRight
                        className={`h-3.5 w-3.5 text-text-tertiary transition-opacity ${
                          isSelected ? 'opacity-100' : 'opacity-0'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="border-t border-border bg-sidebar/50 px-4 py-2 text-[11px] text-text-tertiary flex items-center justify-between">
            <span>Navigation & Workspace search</span>
            <span>Use ↑↓ to navigate, Enter to open</span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
