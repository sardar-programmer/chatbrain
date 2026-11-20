import { useMemo } from 'react';
import { type ConversationDetailResponse, type MessageItem } from '../../services/api/types';
import { type LiveReplyState } from './chatStreamTypes';

export function useDisplayMessages(
  conversation: ConversationDetailResponse | undefined,
  liveState: LiveReplyState | null,
  convId: string | undefined,
): MessageItem[] {
  return useMemo(() => {
    const persistedMessages: MessageItem[] = conversation?.messages ?? [];
    const baseMessages = liveState?.isRegenerating
      ? (() => {
          if (liveState.editedMessageId) {
            const targetIdx = persistedMessages.findIndex(m => m.id === liveState.editedMessageId);
            if (targetIdx !== -1) {
              const sliced = persistedMessages.slice(0, targetIdx + 1);
              if (liveState.editedContent) {
                sliced[targetIdx] = { ...sliced[targetIdx], content: liveState.editedContent };
              }
              return sliced;
            }
          }
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

    return (liveState && !hasPersistedAssistant)
      ? [...userMessages, {
          id: liveState.assistantMessageId || 'live-assistant',
          conversation_id: convId ?? '',
          role: 'assistant',
          content: liveState.text,
          status: 'streaming',
          created_at: new Date().toISOString(),
        }]
      : userMessages;
  }, [conversation?.messages, liveState, convId]);
}
