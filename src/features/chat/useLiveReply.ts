import { useSyncExternalStore } from 'react';
import {
  subscribeLiveReply,
  getLiveReply,
  getConversationError,
} from './chatStreamStore';
import { type LiveReplyState, type ConversationError } from './chatStreamTypes';

export function useLiveReply(conversationId: string | undefined): LiveReplyState | null {
  return useSyncExternalStore(
    subscribeLiveReply,
    () => (conversationId ? getLiveReply(conversationId) : null),
    () => null,
  );
}

export function useConversationError(conversationId: string | undefined): ConversationError | null {
  return useSyncExternalStore(
    subscribeLiveReply,
    () => (conversationId ? getConversationError(conversationId) : null),
    () => null,
  );
}
