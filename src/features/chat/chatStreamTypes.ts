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

export interface ConversationError {
  category?: string | null;
  code?: string | null;
  message?: string | null;
}
