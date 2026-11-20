/**
 * Shared mutable state for the chat stream store.
 * Extracted to break the circular import between chatStreamStore and chatStreamRunner.
 */
import { type LiveReplyState, type ConversationError } from './chatStreamTypes';

export const activeStreams = new Map<string, LiveReplyState>();
export const conversationErrors = new Map<string, ConversationError>();
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

export function scheduleNotify(): void {
  if (notifyRafId !== null) return;
  const cb = () => { notifyRafId = null; notifyListeners(); };
  notifyRafId = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame(cb)
    : (setTimeout(cb, 50) as unknown as number);
}

export function subscribeLiveReply(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
