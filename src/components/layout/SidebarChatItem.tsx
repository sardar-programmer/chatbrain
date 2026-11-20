import React, { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal, Pencil, Pin, PinOff, Trash2, MessageSquare } from 'lucide-react';
import { type ConversationItem } from '../../services/api/types';

interface SidebarChatItemProps {
  conversation: ConversationItem;
  onNavigate?: () => void;
  onRename: (id: string, newTitle: string) => Promise<void>;
  onTogglePin: (id: string, pinned: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export const SidebarChatItem: React.FC<SidebarChatItemProps> = ({
  conversation,
  onNavigate,
  onRename,
  onTogglePin,
  onDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState(conversation.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraftTitle(conversation.title);
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditing, conversation.title]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleSaveRename = useCallback(async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed || trimmed.length > 200 || trimmed === conversation.title) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    await onRename(conversation.id, trimmed);
  }, [draftTitle, conversation.id, conversation.title, onRename]);

  const handleCancelRename = useCallback(() => {
    setDraftTitle(conversation.title);
    setIsEditing(false);
  }, [conversation.title]);

  if (isEditing) {
    return (
      <div className="flex h-9 items-center px-2">
        <input
          ref={inputRef}
          type="text"
          value={draftTitle}
          maxLength={200}
          onChange={e => setDraftTitle(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); void handleSaveRename(); }
            else if (e.key === 'Escape') { e.preventDefault(); handleCancelRename(); }
          }}
          onBlur={handleCancelRename}
          className="w-full rounded border border-accent/60 bg-sidebar px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
        />
      </div>
    );
  }

  return (
    <NavLink
      to={`/chat/${conversation.id}`}
      onClick={onNavigate}
      className={({ isActive }) =>
        `group relative flex h-9 items-center rounded-lg px-2 text-xs transition-all duration-150 ${
          isActive
            ? 'bg-sidebar-accent text-text-primary font-medium border border-accent/20'
            : 'text-text-secondary hover:bg-sidebar-accent/70 hover:text-text-primary border border-transparent'
        }`
      }
    >
      {conversation.pinned ? (
        <Pin className="h-3.5 w-3.5 mr-2 shrink-0 text-accent rotate-45" />
      ) : (
        <MessageSquare className="h-3.5 w-3.5 mr-2 shrink-0 text-text-tertiary group-hover:text-accent transition-colors" />
      )}

      <span className="truncate flex-1 pr-1">{conversation.title || 'Conversation'}</span>

      {/* Custom menu — avoids Radix Portal which breaks in JSDOM */}
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          aria-label="Chat options"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={e => { e.preventDefault(); e.stopPropagation(); setMenuOpen(v => !v); }}
          className="rail-btn h-6 w-6 p-0 rounded opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity flex items-center justify-center text-text-tertiary hover:text-text-primary"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>

        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-7 z-50 min-w-[130px] rounded-lg border border-border/80 bg-surface/95 backdrop-blur-xl p-1 text-xs text-text-primary shadow-lg select-none"
            onClick={e => e.stopPropagation()}
          >
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent hover:text-text-primary cursor-pointer outline-none transition-colors"
              onClick={() => { setMenuOpen(false); setIsEditing(true); }}
            >
              <Pencil className="h-3.5 w-3.5 text-text-tertiary" />
              <span>Rename</span>
            </button>
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-sidebar-accent hover:text-text-primary cursor-pointer outline-none transition-colors"
              onClick={() => { setMenuOpen(false); void onTogglePin(conversation.id, !conversation.pinned); }}
            >
              {conversation.pinned ? (
                <><PinOff className="h-3.5 w-3.5 text-text-tertiary" /><span>Unpin</span></>
              ) : (
                <><Pin className="h-3.5 w-3.5 text-text-tertiary rotate-45" /><span>Pin</span></>
              )}
            </button>
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md hover:bg-error/10 text-error hover:text-error cursor-pointer outline-none transition-colors"
              onClick={() => { setMenuOpen(false); void onDelete(conversation.id); }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          </div>
        )}
      </div>
    </NavLink>
  );
};
