/**
 * Module-level stream store for in-flight replies and conversation errors.
 * Immutable updates ensure useSyncExternalStore triggers re-renders per delta.
 */

import { type QueryClient } from '@tanstack/react-query';
import { fetchReplyStream, type SSEEvent } from './sse';
import { type MessageItem } from '../../services/api/types';
import { type LiveReplyState, type ConversationError } from './chatStreamTypes';
import { startCountdown, clearCountdown } from './chatCountdown';

export * from './chatStreamTypes';
export { useLiveReply, useConversationError } from './useLiveReply';

const activeStreams = new Map<string, LiveReplyState>();
const conversationErrors = new Map<string, ConversationError>();
const listeners = new Set<() => void>();
let notifyRafId: number | null = null;

function notifyListeners(): void {
  for (const listener of listeners) listener();
}

export function flushNotify(): void {
  if (notifyRafId !== null) {
    if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(notifyRafId);
    else clearTimeout(notifyRafId);
    notifyRafId = null;
  }
  notifyListeners();
}

function scheduleNotify(): void {
  if (notifyRafId !== null) return;
  const cb = () => { notifyRafId = null; notifyListeners(); };
  notifyRafId = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : (setTimeout(cb, 50) as unknown as number);
}

export function subscribeLiveReply(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getLiveReply(conversationId: string): LiveReplyState | null {
  return activeStreams.get(conversationId) ?? null;
}

export function getConversationError(conversationId: string): ConversationError | null {
  return conversationErrors.get(conversationId) ?? null;
}

export function clearConversationError(conversationId: string): void {
  if (conversationErrors.delete(conversationId)) flushNotify();
}

export function isConversationStreaming(conversationId: string): boolean {
  return activeStreams.has(conversationId);
}

function handleRetryCountdown(conversationId: string, seconds: number, attempt = 1): void {
  startCountdown(conversationId, seconds, attempt, secondsLeft => {
    const s = activeStreams.get(conversationId);
    if (!s || s.phase !== 'retrying') {
      clearCountdown(conversationId);
      return;
    }
    activeStreams.set(conversationId, { ...s, retry: { attempt, secondsLeft } });
    flushNotify();
  });
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
  });
  flushNotify();
  await executeStream(conversationId, { content: trimmed }, controller, queryClient, showToast);
}

export async function regenerateReply(
  conversationId: string,
  queryClient: QueryClient,
  showToast?: (toast: { message: string; type?: 'info' | 'error' | 'success' }) => void,
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
  });
  flushNotify();
  await executeStream(conversationId, { regenerate: true }, controller, queryClient, showToast);
}

export function stopReply(conversationId: string): void {
  activeStreams.get(conversationId)?.abortController?.abort();
}

async function executeStream(
  conversationId: string,
  payload: { content?: string; regenerate?: boolean },
  controller: AbortController,
  queryClient: QueryClient,
  showToast?: (toast: { message: string; type?: 'info' | 'error' | 'success' }) => void,
): Promise<void> {
  try {
    const handleEvent = (evt: SSEEvent) => {
      const stream = activeStreams.get(conversationId);
      if (!stream) return;
      if (evt.event === 'message_created') {
        const optUser = stream.optimisticUserMessage && evt.data.user_message_id
          ? { ...stream.optimisticUserMessage, id: evt.data.user_message_id }
          : stream.optimisticUserMessage;
        activeStreams.set(conversationId, {
          ...stream,
          assistantMessageId: evt.data.assistant_message_id,
          userMessageId: evt.data.user_message_id,
          optimisticUserMessage: optUser,
        });
        flushNotify();
      } else if (evt.event === 'status') {
        activeStreams.set(conversationId, { ...stream, phase: evt.data.phase, statusText: evt.data.text });
        if (evt.data.phase === 'retrying') {
          handleRetryCountdown(conversationId, evt.data.retry_in_seconds ?? 3, evt.data.attempt ?? 1);
        } else {
          clearCountdown(conversationId);
        }
        flushNotify();
      } else if (evt.event === 'delta') {
        clearCountdown(conversationId);
        activeStreams.set(conversationId, {
          ...stream,
          phase: 'writing',
          text: stream.text + evt.data.text,
          statusText: null,
        });
        scheduleNotify();
      } else if (evt.event === 'error') {
        conversationErrors.set(conversationId, {
          category: evt.data.category,
          code: evt.data.code,
          message: evt.data.message,
        });
        flushNotify();
      }
    };

    await fetchReplyStream(conversationId, payload, { signal: controller.signal, onEvent: handleEvent });
  } catch (err: unknown) {
    const isAbort = (err as Error)?.name === 'AbortError';
    const isConflict = (err as { status?: number })?.status === 409;
    if (isConflict) {
      conversationErrors.set(conversationId, {
        category: 'provider',
        code: 'bad_request',
        message: 'A reply is already running for this conversation.',
      });
      showToast?.({ message: 'A reply is already streaming for this conversation.', type: 'info' });
    } else if (!isAbort) {
      conversationErrors.set(conversationId, {
        category: 'network',
        code: 'interrupted',
        message: (err as Error)?.message || 'Connection to Chat-Brain lost.',
      });
    }
  } finally {
    clearCountdown(conversationId);
    flushNotify();
    try {
      await queryClient.refetchQueries({ queryKey: ['conversation', conversationId] });
    } finally {
      activeStreams.delete(conversationId);
      flushNotify();
    }
  }
}
