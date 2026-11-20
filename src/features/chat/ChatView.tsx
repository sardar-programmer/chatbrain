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
import { useDisplayMessages } from './useDisplayMessages';
import {
  useLiveReply,
  useConversationError,
  sendReply,
  regenerateReply,
  editAndResendReply,
  stopReply,
  isConversationStreaming,
} from './chatStreamStore';

type ConfirmAction =
  | { type: 'regenerate'; id: string; laterCount: number }
  | { type: 'edit'; id: string; newContent: string; laterCount: number };

export const ChatView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const initialSentRef = useRef(false);
  const composerRef = useRef<HTMLDivElement>(null);

  const [composerHeight, setComposerHeight] = useState(110);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => getConversation(id!),
    enabled: !!id,
  });

  const liveState = useLiveReply(id);
  const convError = useConversationError(id);
  const streaming = id ? isConversationStreaming(id) : false;
  const { showJumpToLatest, setContainerRef, jumpToLatest, scheduleStickToBottom } = useChatScroll();
  const displayMessages = useDisplayMessages(conversation, liveState, id);

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
      setConfirmAction({ type: 'regenerate', id: msgId, laterCount });
    }
  }, [id, streaming, queryClient, showToast, jumpToLatest]);

  const handleEditClick = useCallback((msgId: string, newContent: string) => {
    if (!id || streaming) return;
    const msgIdx = displayMessages.findIndex(m => m.id === msgId);
    const laterCount = msgIdx === -1 ? 0 : displayMessages.length - 1 - msgIdx;
    if (laterCount > 0) {
      setConfirmAction({ type: 'edit', id: msgId, newContent, laterCount });
    } else {
      jumpToLatest();
      void editAndResendReply(id, msgId, newContent, queryClient, showToast);
    }
  }, [id, streaming, displayMessages, queryClient, showToast, jumpToLatest]);

  const handleConfirmAction = useCallback(() => {
    if (!id || !confirmAction) return;
    jumpToLatest();
    const action = confirmAction;
    setConfirmAction(null);
    if (action.type === 'regenerate') {
      void regenerateReply(id, queryClient, showToast, action.id);
    } else {
      void editAndResendReply(id, action.id, action.newContent, queryClient, showToast);
    }
  }, [id, confirmAction, queryClient, showToast, jumpToLatest]);

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
            (m.role === 'assistant' && idx === displayMessages.length - 1)
          );
          const isLastAsst = m.role === 'assistant' && idx === lastAssistantIdx;
          const laterCount = displayMessages.length - 1 - idx;

          return (
            <ChatMessage
              key={m.id || idx}
              message={m}
              liveState={isLive ? liveState : null}
              onRegenerate={m.role === 'assistant' ? () => handleRegenerateClick(m.id, isLastAsst, laterCount) : undefined}
              onEditUserMessage={m.role === 'user' ? (msgId, text) => handleEditClick(msgId, text) : undefined}
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
        open={confirmAction !== null}
        onOpenChange={open => !open && setConfirmAction(null)}
        title={confirmAction?.type === 'edit' ? 'Edit message?' : 'Regenerate this answer?'}
        description={
          confirmAction?.type === 'edit'
            ? `Editing this message removes the ${confirmAction.laterCount} message${confirmAction.laterCount === 1 ? '' : 's'} after it.`
            : `Regenerate this answer? The ${confirmAction?.laterCount} message${confirmAction?.laterCount === 1 ? '' : 's'} after it will be removed.`
        }
        confirmText={confirmAction?.type === 'edit' ? 'Save & resend' : 'Regenerate'}
        isDestructive={true}
        onConfirm={handleConfirmAction}
      />
    </div>
  );
};
