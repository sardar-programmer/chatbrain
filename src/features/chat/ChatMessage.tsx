/**
 * ChatMessage — renders one message in all 6 states.
 * States: waiting | streaming | retrying | done | stopped | error
 * Receives persisted MessageItem + optional LiveReplyState override.
 */
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, RotateCcw, Square } from 'lucide-react';
import { type MessageItem } from '../../services/api/types';
import { type LiveReplyState } from './chatStreamStore';
import { ChatErrorCard } from './ChatErrorCard';
import { CodeBlock } from './CodeBlock';

export interface ChatMessageProps {
  message: MessageItem;
  liveState?: LiveReplyState | null;
  onRegenerate?: () => void;
  isLast?: boolean;
  isStreaming?: boolean;
}

// ---- Markdown renderer ----
const MarkdownBody: React.FC<{ content: string }> = ({ content }) => (
  <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-hidden text-text-primary">
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const isInline = !match && !String(children).includes('\n');
          if (isInline) {
            return (
              <code
                className="rounded-md bg-accent-soft/40 px-1.5 py-0.5 font-mono text-xs text-accent border border-accent/20"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <CodeBlock language={match ? match[1] : ''} code={String(children).replace(/\n$/, '')} />
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
  </div>
);

// ---- Main component ----
export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  liveState,
  onRegenerate,
  isLast = false,
}) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const isUser = message.role === 'user';

  const handleCopyResponse = () => {
    const text = liveState?.text ?? message.content ?? '';
    void navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // ---- User bubble ----
  if (isUser) {
    return (
      <div className="flex justify-end w-full my-3 animate-in fade-in duration-200">
        <div className="msg-user max-w-[80%] text-sm text-text-primary shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed m-0">{message.content}</p>
        </div>
      </div>
    );
  }

  // ---- Determine display state from liveState + persisted message ----
  const phase = liveState?.phase ?? null;
  const liveText = liveState?.text ?? '';
  const displayContent = liveState ? liveText : (message.content ?? '');
  const isWaiting = liveState && !liveText && phase !== 'retrying';
  const isRetrying = phase === 'retrying';
  const isWriting = liveState && (liveText.length > 0 || phase === 'writing');
  const isError = !liveState && (message.status === 'error' || message.status === 'failed');
  const isStopped = !liveState && message.status === 'stopped';

  // ---- Waiting state ----
  if (isWaiting) {
    return (
      <div className="flex flex-col w-full my-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-xs text-text-secondary py-1 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>{liveState?.statusText ?? 'Preparing…'}</span>
        </div>
      </div>
    );
  }

  // ---- Retrying state ----
  if (isRetrying) {
    const { attempt, secondsLeft } = liveState!.retry ?? { attempt: 1, secondsLeft: 0 };
    return (
      <div className="flex flex-col w-full my-4 animate-in fade-in duration-200">
        <div className="flex items-center gap-2 text-xs text-text-secondary py-1 font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>
            All models are busy right now. Retrying in {secondsLeft}s (attempt {attempt})
          </span>
        </div>
        {displayContent ? <MarkdownBody content={displayContent} /> : null}
      </div>
    );
  }

  // ---- Streaming / writing state ----
  if (isWriting) {
    return (
      <div className="flex flex-col w-full my-4 animate-in fade-in duration-200">
        {displayContent ? (
          <>
            <MarkdownBody content={displayContent} />
            <span
              aria-hidden="true"
              className="inline-block w-0.5 h-4 bg-accent ml-0.5 motion-safe:animate-[blink_1s_step-end_infinite]"
            />
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs text-text-secondary py-1 font-mono">
            <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
            <span>{liveState?.statusText ?? 'Writing…'}</span>
          </div>
        )}
      </div>
    );
  }

  // ---- Error state (persisted or live error event) ----
  if (isError) {
    return (
      <div className="group flex flex-col w-full my-4 animate-in fade-in duration-200">
        {displayContent ? <MarkdownBody content={displayContent} /> : null}
        <ChatErrorCard
          errorCategory={message.error_category}
          rawMessage={undefined}
          onRetry={onRegenerate}
          isStreaming={false}
        />
      </div>
    );
  }

  // ---- Stopped state (persisted) ----
  if (isStopped) {
    return (
      <div className="group flex flex-col w-full my-4 animate-in fade-in duration-200">
        {displayContent ? <MarkdownBody content={displayContent} /> : null}
        <div className="flex items-center gap-1.5 pt-1.5 text-xs text-text-tertiary">
          <Square className="h-3 w-3 shrink-0" />
          <span>Stopped</span>
        </div>
        <div className="flex items-center gap-1.5 pt-1 text-text-tertiary opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {displayContent && (
            <button
              type="button"
              onClick={handleCopyResponse}
              aria-label="Copy response"
              title="Copy response"
              className="rail-btn !w-7 !h-7 !rounded-lg text-text-tertiary hover:text-text-primary focus:outline-none"
            >
              {copiedResponse ? (
                <Check className="h-3.5 w-3.5 text-status-success" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </button>
          )}
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate response"
              title="Regenerate response"
              className="rail-btn !w-7 !h-7 !rounded-lg text-text-tertiary hover:text-text-primary focus:outline-none"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ---- Done state (default for completed messages) ----
  return (
    <div className="group flex flex-col w-full my-4 animate-in fade-in duration-200 focus-within:outline-none">
      {displayContent ? <MarkdownBody content={displayContent} /> : null}
      {displayContent && (
        <div className="flex items-center gap-1.5 pt-2 text-text-tertiary opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={handleCopyResponse}
            aria-label="Copy response"
            title="Copy response"
            className="rail-btn !w-7 !h-7 !rounded-lg text-text-tertiary hover:text-text-primary focus:outline-none"
          >
            {copiedResponse ? (
              <Check className="h-3.5 w-3.5 text-status-success" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          {isLast && onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              aria-label="Regenerate response"
              title="Regenerate response"
              className="rail-btn !w-7 !h-7 !rounded-lg text-text-tertiary hover:text-text-primary focus:outline-none"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
