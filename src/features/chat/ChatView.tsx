import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { MessageSquare } from 'lucide-react';
import { Composer, ComposerAttachment } from '../../components/shared/Composer';
import { ChatMessage } from './ChatMessage';
import { getConversation, getBootstrapToken } from '../../services/api/client';
import { MessageItem } from '../../services/api/types';

export const ChatView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [conversationTitle, setConversationTitle] = useState('Conversation');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialSentRef = useRef(false);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load existing conversation
  useEffect(() => {
    if (!id) return;
    let active = true;

    async function loadData() {
      setIsLoading(true);
      try {
        const data = await getConversation(id!);
        if (active && data) {
          setConversationTitle(data.title || 'Conversation');
          setMessages(data.messages || []);
        }
      } catch {
        if (active) {
          setConversationTitle('Chat Session');
          setMessages([]);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [id]);

  const streamReply = useCallback(async (content: string) => {
    if (!id) return;
    setIsStreaming(true);

    const userMsg: MessageItem = {
      id: Math.random().toString(36).substring(2, 9),
      conversation_id: id,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    };

    const assistantMsgId = Math.random().toString(36).substring(2, 9);
    const assistantMsg: MessageItem = {
      id: assistantMsgId,
      conversation_id: id,
      role: 'assistant',
      content: '',
      status: 'streaming',
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = await getBootstrapToken();
      const res = await fetch(`/api/v1/conversations/${id}/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ChatBrain-Token': token,
        },
        body: JSON.stringify({ content }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Failed to stream reply (status ${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const block of lines) {
          const eventLine = block.split('\n').find(l => l.startsWith('event: '));
          const dataLine = block.split('\n').find(l => l.startsWith('data: '));
          if (!dataLine) continue;

          const eventType = eventLine ? eventLine.replace('event: ', '').trim() : 'message';
          try {
            const data = JSON.parse(dataLine.replace('data: ', '').trim());
            if (eventType === 'delta' && data.text) {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId ? { ...m, content: m.content + data.text } : m,
                ),
              );
            } else if (eventType === 'finish') {
              setMessages(prev =>
                prev.map(m =>
                  m.id === assistantMsgId
                    ? { ...m, status: 'done', model_used: data.model_used }
                    : m,
                ),
              );
            }
          } catch {
            // Ignore parse errors on ping
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== 'AbortError') {
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  content:
                    m.content ||
                    'Unable to complete reply. Please verify your Gemini API key in Settings.',
                  status: 'failed',
                }
              : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [id]);

  // Initial prompt from state navigation
  useEffect(() => {
    const state = location.state as { initialPrompt?: string } | null;
    if (state?.initialPrompt && !initialSentRef.current && !isLoading) {
      initialSentRef.current = true;
      streamReply(state.initialPrompt);
    }
  }, [location.state, isLoading, streamReply]);

  const handleStop = () => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  };

  const handleComposerSubmit = (content: string, _attachments: ComposerAttachment[]) => {
    streamReply(content);
  };

  return (
    <div className="flex flex-col min-h-full max-w-3xl mx-auto px-4 pt-6 pb-36">
      {/* Conversation title: 14px muted text, non-sticky, no background, no border */}
      {conversationTitle && (
        <div className="pb-4">
          <h2 className="text-[14px] text-text-secondary truncate font-normal select-none">
            {conversationTitle}
          </h2>
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 flex flex-col justify-start">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
            <div className="h-12 w-12 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-3">
              <MessageSquare className="h-6 w-6 stroke-[1.75]" />
            </div>
            <h2 className="text-base font-semibold text-text-primary mb-1">Conversation Ready</h2>
            <p className="text-xs text-text-secondary max-w-xs">
              Type a message below to start streaming with your AI model.
            </p>
          </div>
        )}

        {messages.map((m, idx) => (
          <ChatMessage
            key={m.id || idx}
            message={m}
            isStreaming={isStreaming && idx === messages.length - 1 && m.role === 'assistant'}
            onRegenerate={streamReply}
          />
        ))}
        <div ref={bottomRef} className="h-4" />
      </div>

      {/* Floating Bottom Glass Composer (aligned with max-w-3xl message column) */}
      <div className="fixed bottom-0 left-0 right-0 md:left-[var(--sidebar-width,72px)] z-30 p-4 pointer-events-none transition-all">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          <Composer
            variant="chat"
            placeholder="Ask anything..."
            onSubmit={handleComposerSubmit}
            isStreaming={isStreaming}
            onStop={handleStop}
          />
        </div>
      </div>
    </div>
  );
};
