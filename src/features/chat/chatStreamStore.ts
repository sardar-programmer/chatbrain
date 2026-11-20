/**
 * Module-level stream store: public API for in-flight replies and conversation errors.
 * State lives in chatStreamState; execution logic in chatStreamRunner.
 */
import { type QueryClient } from '@tanstack/react-query';
import { type MessageItem } from '../../services/api/types';
import { updateMessage } from '../../services/api/client';
import { type LiveReplyState, type ConversationError } from './chatStreamTypes';
import {
  activeStreams,
  conversationErrors,
  subscribeLiveReply,
  flushNotify,
} from './chatStreamState';
import { executeStream } from './chatStreamRunner';

export * from './chatStreamTypes';
export { useLiveReply, useConversationError } from './useLiveReply';

export { subscribeLiveReply };

export function getLiveReply(conversationId: string): LiveReplyState | null {
  return activeStreams.get(conversationId) ?? null;
}

export function getConversationError(conversationId: string): ConversationError | null {
  return conversationErrors.get(conversationId) ?? null;
}

export function clearConversationError(conversationId: string): void {
  conversationErrors.delete(conversationId);
  flushNotify();
}

export function isConversationStreaming(conversationId: string): boolean {
  return activeStreams.has(conversationId);
}

export async function sendReply(
  conversationId: string,
  content: string,
  queryClient: QueryClient,
  showToast?: (toast: { message: string; type?: 'info' | 'error' | 'success' }) => void,
): Promise<void> {
  const trimmed = content.trim();
  if (!trimmed) return;
  if (activeStreams.has(conversationId)) {
    showToast?.({ message: 'A reply is already streaming for this conversation.', type: 'info' });
    return;
  }
  conversationErrors.delete(conversationId);
  const controller = new AbortController();
  const optimisticUserMessage: MessageItem = {
    id: `temp-u-${Date.now()}`,
    conversation_id: conversationId,
    role: 'user',
    content: trimmed,
    created_at: new Date().toISOString(),
    status: 'done',
  };
  activeStreams.set(conversationId, {
    conversationId,
    assistantMessageId: null,
    userMessageId: null,
    optimisticUserMessage,
    text: '',
    phase: 'preparing',
    statusText: 'Preparing your message',
    retry: null,
    abortController: controller,
    isRegenerating: false,
    regenerateFromId: null,
  });
  flushNotify();
  await executeStream(conversationId, { content: trimmed }, controller, queryClient, showToast);
}

export async function regenerateReply(
  conversationId: string,
  queryClient: QueryClient,
  showToast?: (toast: { message: string; type?: 'info' | 'error' | 'success' }) => void,
  fromMessageId?: string,
): Promise<void> {
  if (activeStreams.has(conversationId)) {
    showToast?.({ message: 'A reply is already streaming for this conversation.', type: 'info' });
    return;
  }
  conversationErrors.delete(conversationId);
  const controller = new AbortController();
  activeStreams.set(conversationId, {
    conversationId,
    assistantMessageId: null,
    userMessageId: null,
    optimisticUserMessage: null,
    text: '',
    phase: 'preparing',
    statusText: 'Preparing...',
    retry: null,
    abortController: controller,
    isRegenerating: true,
    regenerateFromId: fromMessageId ?? null,
  });
  flushNotify();
  const payload = fromMessageId ? { regenerate_from: fromMessageId } : { regenerate: true };
  await executeStream(conversationId, payload, controller, queryClient, showToast);
}

export async function editAndResendReply(
  conversationId: string,
  messageId: string,
  newContent: string,
  queryClient: QueryClient,
  showToast?: (toast: { message: string; type?: 'info' | 'error' | 'success' }) => void,
): Promise<void> {
  if (activeStreams.has(conversationId)) {
    showToast?.({ message: 'A reply is already streaming for this conversation.', type: 'info' });
    return;
  }
  conversationErrors.delete(conversationId);
  await updateMessage(messageId, { content: newContent });
  const controller = new AbortController();
  activeStreams.set(conversationId, {
    conversationId,
    assistantMessageId: null,
    userMessageId: messageId,
    optimisticUserMessage: null,
    text: '',
    phase: 'preparing',
    statusText: 'Preparing...',
    retry: null,
    abortController: controller,
    isRegenerating: true,
    regenerateFromId: null,
    editedMessageId: messageId,
    editedContent: newContent,
  });
  flushNotify();
  await executeStream(conversationId, {}, controller, queryClient, showToast);
}

export function stopReply(conversationId: string): void {
  activeStreams.get(conversationId)?.abortController?.abort();
}
