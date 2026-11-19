/**
 * ChatView — single-conversation chat page.
 * Uses TanStack Query as source of truth + module-level stream store for in-flight state.
 * Never constructs user messages in the UI for retry/regenerate — always uses {regenerate:true}.
 */
import React, { useEffect, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConversation } from '../../services/api/client';
import { Composer, type ComposerAttachment } from '../../components/shared/Composer';
import { useToast } from '../../components/shared/Toast';
import { ChatMessage } from './ChatMessage';
import {
  useLiveReply,
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
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  // ---- Persisted truth from TanStack Query ----
  const { data: conversation, isLoading } = useQuery({
    queryKey: ['conversation', id],
    queryFn: () => getConversation(id!),
    enabled: !!id,
  });

  // ---- In-flight live state ----
  const liveState = useLiveReply(id);
  const streaming = id ? isConversationStreaming(id) : false;

  // ---- Build display message list ----
  const persistedMessages: MessageItem[] = conversation?.messages ?? [];

  // When regenerating: hide last assistant message (live state replaces it)
  const baseMessages = liveState?.isRegenerating
    ? (() => {
        const lastAssistantIdx = [...persistedMessages].reverse().findIndex(
          m => m.role === 'assistant',
        );
        if (lastAssistantIdx === -1) return persistedMessages;
        return persistedMessages.slice(0, persistedMessages.length - 1 - lastAssistantIdx);
      })()
    : persistedMessages;

  // Append optimistic user message if streaming a new reply
  const displayMessages: MessageItem[] = [
    ...baseMessages,
    ...(liveState?.optimisticUserMessage ? [liveState.optimisticUserMessage] : []),
  ];

  // ---- Scroll to bottom on new content ----
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length, liveState?.text]);

  // ---- Send initial prompt from navigation state ----
  useEffect(() => {
    const state = location.state as { initialPrompt?: string } | null;
    if (state?.initialPrompt && !initialSentRef.current && !isLoading && id) {
      initialSentRef.current = true;
      window.history.replaceState({}, document.title);
      void sendReply(id, state.initialPrompt, queryClient, showToast);
    }
  }, [location.state, isLoading, id, queryClient, showToast]);

  // ---- Handlers ----
  const handleComposerSubmit = (content: string, _attachments: ComposerAttachment[]) => {
    if (!id) return;
    void sendReply(id, content, queryClient, showToast);
  };

  const handleRegenerate = () => {
    if (!id) return;
    void regenerateReply(id, queryClient, showToast);
  };

  const handleStop = () => {
    if (!id) return;
    stopReply(id);
  };

  // ---- Determine last assistant index for Regenerate button ----
  const lastAssistantIdx = (() => {
    for (let i = displayMessages.length - 1; i >= 0; i--) {
      if (displayMessages[i].role === 'assistant') return i;
    }
    return -1;
  })();

  return (
    <div className="flex flex-col min-h-full max-w-3xl mx-auto px-4 pt-6 pb-36">
      {/* Conversation title: 14px muted, non-sticky */}
      {conversation?.title && (
        <div className="pb-4">
          <h2 className="text-[14px] text-text-secondary truncate font-normal select-none">
            {conversation.title}
          </h2>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 flex flex-col justify-start">
        {displayMessages.map((m, idx) => {
          const isLastMsg = idx === displayMessages.length - 1;
          // Attach live state to the last assistant message if streaming
          const msgLiveState =
            liveState && m.role === 'assistant' && isLastMsg && m.id === liveState.assistantMessageId
              ? liveState
              : null;

          return (
            <ChatMessage
              key={m.id || idx}
              message={m}
              liveState={msgLiveState}
              onRegenerate={
                m.role === 'assistant' && idx === lastAssistantIdx ? handleRegenerate : undefined
              }
              isLast={m.role === 'assistant' && idx === lastAssistantIdx}
            />
          );
        })}

        {/* Live assistant bubble — shown ONLY when streaming and no persisted assistant message yet */}
        {liveState && liveState.assistantMessageId === null && (
          <ChatMessage
            key="live-assistant"
            message={{
              id: 'live-assistant',
              conversation_id: id ?? '',
              role: 'assistant',
              content: liveState.text,
              status: 'streaming',
              created_at: new Date().toISOString(),
            }}
            liveState={liveState}
          />
        )}

        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Floating composer */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width,72px)] z-30 p-4 pointer-events-none transition-all">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <Composer
            variant="chat"
            placeholder="Ask anything..."
            onSubmit={handleComposerSubmit}
            isStreaming={streaming}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
};
