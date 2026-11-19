/**
 * Module-level stream store for in-flight replies.
 * Holds ONLY the live in-flight state. Single source of truth is TanStack Query cache.
 */

import { useSyncExternalStore } from 'react';
import { type QueryClient } from '@tanstack/react-query';
import { fetchReplyStream, type SSEEvent } from './sse';
import { type MessageItem } from '../../services/api/types';

export interface LiveReplyState {
  conversationId: string;
  assistantMessageId: string | null;
  userMessageId: string | null;
  optimisticUserMessage: MessageItem | null;
  text: string;
  phase: 'preparing' | 'connecting' | 'waiting_first_token' | 'writing' | 'retrying' | null;
  statusText: string | null;
  retry: { attempt: number; secondsLeft: number } | null;
  abortController: AbortController | null;
  isRegenerating: boolean;
}

const activeStreams = new Map<string, LiveReplyState>();
const countdownTimers = new Map<string, ReturnType<typeof setInterval>>();
const listeners = new Set<() => void>();

function notifyListeners(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function subscribeLiveReply(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getLiveReply(conversationId: string): LiveReplyState | null {
  return activeStreams.get(conversationId) ?? null;
}

export function isConversationStreaming(conversationId: string): boolean {
  return activeStreams.has(conversationId);
}

function clearCountdown(conversationId: string): void {
  const timer = countdownTimers.get(conversationId);
  if (timer) {
    clearInterval(timer);
    countdownTimers.delete(conversationId);
  }
}

function startCountdown(conversationId: string, seconds: number, attempt = 1): void {
  clearCountdown(conversationId);
  const stream = activeStreams.get(conversationId);
  if (!stream) return;

  stream.retry = { attempt, secondsLeft: seconds };
  notifyListeners();

  const interval = setInterval(() => {
    const s = activeStreams.get(conversationId);
    if (!s || !s.retry || s.phase !== 'retrying') {
      clearCountdown(conversationId);
      return;
    }
    const nextSeconds = Math.max(0, s.retry.secondsLeft - 1);
    s.retry = { ...s.retry, secondsLeft: nextSeconds };
    notifyListeners();
  }, 1000);

  countdownTimers.set(conversationId, interval);
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
    showToast?.({
      message: 'A reply is already streaming for this conversation.',
      type: 'info',
    });
    return;
  }

  const controller = new AbortController();
  const tempUserId = `temp-u-${Date.now()}`;
  const optimisticUserMessage: MessageItem = {
    id: tempUserId,
    conversation_id: conversationId,
    role: 'user',
    content: trimmed,
    created_at: new Date().toISOString(),
    status: 'done',
  };

  const state: LiveReplyState = {
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
  };

  activeStreams.set(conversationId, state);
  notifyListeners();

  await executeStream(conversationId, { content: trimmed }, controller, queryClient, showToast);
}

export async function regenerateReply(
  conversationId: string,
  queryClient: QueryClient,
  showToast?: (toast: { message: string; type?: 'info' | 'error' | 'success' }) => void,
): Promise<void> {
  if (activeStreams.has(conversationId)) {
    showToast?.({
      message: 'A reply is already streaming for this conversation.',
      type: 'info',
    });
    return;
  }

  const controller = new AbortController();
  const state: LiveReplyState = {
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
  };

  activeStreams.set(conversationId, state);
  notifyListeners();

  await executeStream(conversationId, { regenerate: true }, controller, queryClient, showToast);
}

export function stopReply(conversationId: string): void {
  const stream = activeStreams.get(conversationId);
  if (stream?.abortController) {
    stream.abortController.abort();
  }
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
        stream.assistantMessageId = evt.data.assistant_message_id;
        stream.userMessageId = evt.data.user_message_id;
        if (stream.optimisticUserMessage && evt.data.user_message_id) {
          stream.optimisticUserMessage.id = evt.data.user_message_id;
        }
        notifyListeners();
      } else if (evt.event === 'status') {
        stream.phase = evt.data.phase;
        stream.statusText = evt.data.text;
        if (evt.data.phase === 'retrying') {
          startCountdown(conversationId, evt.data.retry_in_seconds ?? 3, evt.data.attempt ?? 1);
        } else {
          clearCountdown(conversationId);
          stream.retry = null;
        }
        notifyListeners();
      } else if (evt.event === 'delta') {
        clearCountdown(conversationId);
        stream.phase = 'writing';
        stream.text += evt.data.text;
        stream.statusText = null;
        notifyListeners();
      }
    };

    await fetchReplyStream(conversationId, payload, {
      signal: controller.signal,
      onEvent: handleEvent,
    });
  } catch (err: unknown) {
    const isAbort = (err as Error)?.name === 'AbortError';
    const isConflict = (err as { status?: number })?.status === 409;

    if (isConflict) {
      showToast?.({
        message: 'A reply is already streaming for this conversation.',
        type: 'info',
      });
    } else if (!isAbort) {
      // Fetch or network failure
      showToast?.({
        message: 'Connection to Chat-Brain lost.',
        type: 'error',
      });
    }
  } finally {
    clearCountdown(conversationId);
    activeStreams.delete(conversationId);
    notifyListeners();
    // Always refetch from server after any stream end to show persisted truth
    await queryClient.refetchQueries({ queryKey: ['conversation', conversationId] });
  }
}

export function useLiveReply(conversationId: string | undefined): LiveReplyState | null {
  return useSyncExternalStore(
    subscribeLiveReply,
    () => (conversationId ? getLiveReply(conversationId) : null),
    () => null,
  );
}
