/**
 * Stream executor: runs the SSE reply loop and updates shared state.
 * Separated from chatStreamStore to avoid circular imports.
 */
import { type QueryClient } from '@tanstack/react-query';
import { fetchReplyStream, type SSEEvent } from './sse';
import { clearCountdown, startCountdown } from './chatCountdown';
import {
  activeStreams,
  conversationErrors,
  flushNotify,
  scheduleNotify,
} from './chatStreamState';

function handleRetryCountdown(conversationId: string, seconds: number, attempt = 1): void {
  startCountdown(conversationId, seconds, attempt, secondsLeft => {
    const s = activeStreams.get(conversationId);
    if (!s || s.phase !== 'retrying') { clearCountdown(conversationId); return; }
    activeStreams.set(conversationId, { ...s, retry: { attempt, secondsLeft } });
    flushNotify();
  });
}

export async function executeStream(
  conversationId: string,
  payload: { content?: string; regenerate?: boolean; regenerate_from?: string },
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
          ...stream, phase: 'writing', text: stream.text + evt.data.text, statusText: null,
        });
        scheduleNotify();
      } else if (evt.event === 'error') {
        conversationErrors.set(conversationId, {
          category: evt.data.category, code: evt.data.code, message: evt.data.message,
        });
        flushNotify();
      }
    };

    await fetchReplyStream(conversationId, payload, { signal: controller.signal, onEvent: handleEvent });
  } catch (err: unknown) {
    const isAbort = (err as Error)?.name === 'AbortError';
    const isConflict = (err as { status?: number })?.status === 409;
    if (isConflict) {
      conversationErrors.set(conversationId, { category: 'provider', code: 'bad_request', message: 'A reply is already running for this conversation.' });
      showToast?.({ message: 'A reply is already streaming for this conversation.', type: 'info' });
    } else if (!isAbort) {
      conversationErrors.set(conversationId, {
        category: 'network', code: 'interrupted',
        message: (err as Error)?.message || 'Connection to Chat-Brain lost.',
      });
    }
  } finally {
    clearCountdown(conversationId);
    flushNotify();
    try {
      await queryClient.refetchQueries({ queryKey: ['conversation', conversationId] });
      await queryClient.refetchQueries({ queryKey: ['conversations'] });
    } finally {
      activeStreams.delete(conversationId);
      flushNotify();
    }
  }
}
