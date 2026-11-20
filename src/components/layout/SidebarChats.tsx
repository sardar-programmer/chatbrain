import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import {
  listConversations,
  updateConversation,
  deleteConversation,
  restoreConversation,
} from '../../services/api/client';
import { SidebarChatItem } from './SidebarChatItem';
import { groupConversations } from '../../features/chat/conversationGrouping';
import { isConversationStreaming, stopReply } from '../../features/chat/chatStreamStore';
import { useToast } from '../shared/Toast';

export const SidebarChats: React.FC<{ onNavigate?: () => void }> = ({ onNavigate }) => {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['conversations', debouncedSearch],
    queryFn: ({ pageParam }) =>
      listConversations({
        search: debouncedSearch || undefined,
        limit: 50,
        cursor: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: lastPage => lastPage.next_cursor ?? undefined,
    staleTime: 10_000,
  });

  const allItems = useMemo(
    () => data?.pages.flatMap(p => p.items) ?? [],
    [data],
  );

  const groups = useMemo(
    () => (debouncedSearch ? [] : groupConversations(allItems)),
    [allItems, debouncedSearch],
  );

  const handleRename = async (id: string, newTitle: string) => {
    await updateConversation(id, { title: newTitle });
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    await queryClient.invalidateQueries({ queryKey: ['conversation', id] });
  };

  const handleTogglePin = async (id: string, pinned: boolean) => {
    await updateConversation(id, { pinned });
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    await queryClient.invalidateQueries({ queryKey: ['conversation', id] });
  };

  const handleDelete = async (id: string) => {
    if (isConversationStreaming(id)) {
      stopReply(id);
    }
    if (location.pathname === `/chat/${id}`) {
      navigate('/');
    }
    await deleteConversation(id);
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });

    showToast({
      message: 'Conversation deleted',
      duration: 6000,
      undoAction: {
        label: 'Undo',
        onClick: async () => {
          await restoreConversation(id);
          await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        },
      },
    });
  };

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-h-0">
      <div className="relative flex items-center px-1">
        <Search className="absolute left-3 h-3.5 w-3.5 text-text-tertiary pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              e.preventDefault();
              setSearch('');
            }
          }}
          placeholder="Search chats..."
          className="w-full rounded-lg border border-border/40 bg-sidebar/60 py-1 pl-7 pr-7 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            aria-label="Clear search"
            className="absolute right-3 flex h-4 w-4 items-center justify-center text-text-tertiary hover:text-text-primary"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {allItems.length === 0 ? (
          <div className="px-2 py-3 text-xs text-text-tertiary italic">
            {debouncedSearch ? 'No chats match your search.' : 'Your chats will appear here.'}
          </div>
        ) : debouncedSearch ? (
          <div className="flex flex-col gap-0.5">
            {allItems.map(c => (
              <SidebarChatItem
                key={c.id}
                conversation={c}
                onNavigate={onNavigate}
                onRename={handleRename}
                onTogglePin={handleTogglePin}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {groups.map(group => (
              <div key={group.label} className="flex flex-col gap-0.5">
                <div className="px-2 pt-2 pb-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    {group.label}
                  </span>
                </div>
                {group.items.map(c => (
                  <SidebarChatItem
                    key={c.id}
                    conversation={c}
                    onNavigate={onNavigate}
                    onRename={handleRename}
                    onTogglePin={handleTogglePin}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ))}
          </div>
        )}

        {hasNextPage && (
          <div className="pt-2 pb-1 text-center">
            <button
              type="button"
              onClick={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
              className="text-xs text-accent hover:underline disabled:opacity-50 select-none cursor-pointer"
            >
              {isFetchingNextPage ? 'Loading...' : 'Show more'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
