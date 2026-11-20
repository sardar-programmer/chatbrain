/**
 * ChatView — single-conversation chat page.
 * Uses TanStack Query as source of truth + module-level stream store for in-flight state.
 * Never constructs user messages in the UI for retry/regenerate.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown } from 'lucide-react';
import { getConversation } from '../../services/api/client';
import { Composer, type ComposerAttachment } from '../../components/shared/Composer';
import { useToast } from '../../components/shared/Toast';
import { ConfirmDialog } from '../../components/shared/ConfirmDialog';
import { ChatMessage } from './ChatMessage';
import { ChatErrorCard } from './ChatErrorCard';
import { UnansweredCard } from './UnansweredCard';
import { useChatScroll } from './useChatScroll';
import {
  useLiveReply,
  useConversationError,
  sendReply,
  regenerateReply,
  stopReply,
  isConversationStreaming,
} from './chatStreamStore';
import { type MessageItem } from '../../services/api/types';

export const ChatView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const initialSentRef = useRef(false);
  const composerRef = useRef<HTMLDivElement>(null);

  const [composerHeight, setComposerHeight] = useState(110);
  const [confirmTarget, setConfirmTarget] = useState<{ id: string; laterCount: number } | null>(null);

  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => getConversation(id!),
    enabled: !!id,
  });

  const liveState = useLiveReply(id);
  const convError = useConversationError(id);
  const streaming = id ? isConversationStreaming(id) : false;
  const { showJumpToLatest, setContainerRef, jumpToLatest, scheduleStickToBottom } = useChatScroll();

  useEffect(() => {
    const el = composerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        const h = entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height;
        if (h > 0) setComposerHeight(h);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const persistedMessages: MessageItem[] = conversation?.messages ?? [];
  const baseMessages = liveState?.isRegenerating
    ? (() => {
        if (liveState.regenerateFromId) {
          const targetIdx = persistedMessages.findIndex(m => m.id === liveState.regenerateFromId);
          return targetIdx === -1 ? persistedMessages : persistedMessages.slice(0, targetIdx);
        }
        const lastIdx = [...persistedMessages].reverse().findIndex(m => m.role === 'assistant');
        return lastIdx === -1 ? persistedMessages : persistedMessages.slice(0, persistedMessages.length - 1 - lastIdx);
      })()
    : persistedMessages;

  const showOptUser = liveState?.optimisticUserMessage &&
    !baseMessages.some(m => m.id === liveState.optimisticUserMessage?.id || (liveState.userMessageId && m.id === liveState.userMessageId));

  const userMessages: MessageItem[] = showOptUser ? [...baseMessages, liveState!.optimisticUserMessage!] : baseMessages;
  const hasPersistedAssistant = !!(liveState?.assistantMessageId && userMessages.some(m => m.id === liveState.assistantMessageId));

  const displayMessages: MessageItem[] = (liveState && !hasPersistedAssistant)
    ? [...userMessages, {
        id: liveState.assistantMessageId || 'live-assistant',
        conversation_id: id ?? '',
        role: 'assistant',
        content: liveState.text,
        status: 'streaming',
        created_at: new Date().toISOString(),
      }]
    : userMessages;

  useEffect(() => {
    scheduleStickToBottom();
  }, [displayMessages.length, liveState?.text, scheduleStickToBottom]);

  useEffect(() => {
    const state = location.state as { initialPrompt?: string } | null;
    if (state?.initialPrompt && !initialSentRef.current && !isLoading && id) {
      initialSentRef.current = true;
      window.history.replaceState({}, document.title);
      jumpToLatest();
      void sendReply(id, state.initialPrompt, queryClient, showToast);
    }
  }, [location.state, isLoading, id, queryClient, showToast, jumpToLatest]);

  const handleComposerSubmit = (content: string, _attachments: ComposerAttachment[]) => {
    if (!id) return;
    jumpToLatest();
    void sendReply(id, content, queryClient, showToast);
  };

  const handleRegenerateClick = useCallback((msgId: string, isLastMsg: boolean, laterCount: number) => {
    if (!id || streaming) return;
    if (isLastMsg) {
      jumpToLatest();
      void regenerateReply(id, queryClient, showToast);
    } else {
      setConfirmTarget({ id: msgId, laterCount });
    }
  }, [id, streaming, queryClient, showToast, jumpToLatest]);

  const handleConfirmRegenerate = useCallback(() => {
    if (!id || !confirmTarget) return;
    jumpToLatest();
    const fromId = confirmTarget.id;
    setConfirmTarget(null);
    void regenerateReply(id, queryClient, showToast, fromId);
  }, [id, confirmTarget, queryClient, showToast, jumpToLatest]);

  const lastAssistantIdx = (() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  const isUnanswered = !streaming && displayMessages.length > 0 &&
    displayMessages[displayMessages.length - 1].role === 'user';

  return (
    <div
      ref={setContainerRef}
      className="flex flex-col min-h-full max-w-3xl mx-auto px-4 pt-6"
      style={{ paddingBottom: `${composerHeight + 24}px` }}
    >
      {conversation?.title && (
        <div className="pb-4">
          <h2 className="text-[14px] text-text-secondary truncate font-normal select-none">
            {conversation.title}
          </h2>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-start">
        {displayMessages.map((m, idx) => {
          const isLive = liveState && (
            m.id === liveState.assistantMessageId ||
            m.id === 'live-assistant' ||
            (!hasPersistedAssistant && idx === displayMessages.length - 1 && m.role === 'assistant')
          );
          const isLastAsst = m.role === 'assistant' && idx === lastAssistantIdx;
          const laterCount = displayMessages.length - 1 - idx;

          return (
            <ChatMessage
              key={m.id || idx}
              message={m}
              liveState={isLive ? liveState : null}
              onRegenerate={m.role === 'assistant' ? () => handleRegenerateClick(m.id, isLastAsst, laterCount) : undefined}
              isLast={isLastAsst}
              isStreaming={streaming}
            />
          );
        })}

        {isUnanswered && (
          convError ? (
            <ChatErrorCard
              errorCategory={convError.code || convError.category}
              rawMessage={convError.message}
              onRetry={() => handleRegenerateClick('', true, 0)}
              isStreaming={streaming}
            />
          ) : (
            <UnansweredCard onRetry={() => handleRegenerateClick('', true, 0)} disabled={streaming} />
          )
        )}
      </div>

      <div
        ref={composerRef}
        className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width,72px)] z-30 pb-4 pointer-events-none transition-all"
      >
        <div className="max-w-3xl mx-auto px-4 pointer-events-auto relative">
          {showJumpToLatest && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 pointer-events-none animate-in fade-in duration-200">
              <button
                type="button"
                onClick={jumpToLatest}
                className="glass-chip h-8 px-3.5 flex items-center gap-1.5 text-xs text-text-primary shadow-md cursor-pointer hover:bg-white/20 select-none pointer-events-auto transition-all"
              >
                <ArrowDown className="h-3.5 w-3.5 text-accent" />
                <span>Jump to latest</span>
              </button>
            </div>
          )}

          <Composer
            variant="chat"
            placeholder="Ask anything..."
            onSubmit={handleComposerSubmit}
            isStreaming={streaming}
            onStop={() => id && stopReply(id)}
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmTarget !== null}
        onOpenChange={(open) => !open && setConfirmTarget(null)}
        title="Regenerate this answer?"
        description={`Regenerate this answer? The ${confirmTarget?.laterCount} message${confirmTarget?.laterCount === 1 ? '' : 's'} after it will be removed.`}
        confirmText="Regenerate"
        isDestructive={true}
        onConfirm={handleConfirmRegenerate}
      />
    </div>
  );
};
