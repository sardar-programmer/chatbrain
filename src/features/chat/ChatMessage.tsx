import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, RefreshCw, RotateCcw } from 'lucide-react';
import { MessageItem } from '../../services/api/types';

interface ChatMessageProps {
  message: MessageItem;
  onRegenerate?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  isStreaming?: boolean;
}

const CodeBlock: React.FC<{ language: string; code: string }> = ({ language, code }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-3 rounded-xl border border-white/10 bg-sidebar/95 shadow-lg overflow-hidden text-left font-mono text-xs">
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-sidebar-accent/60 border-b border-white/5 text-text-tertiary">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
          {language || 'code'}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy code block"
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-text-tertiary hover:text-text-primary hover:bg-white/10 transition-colors focus:outline-none"
        >
          {copied ? <Check className="h-3 w-3 text-status-success" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="p-4 overflow-x-auto text-text-primary leading-relaxed">
        <pre className="m-0 font-mono">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
};

export const ChatMessage: React.FC<ChatMessageProps> = ({
  message,
  onRegenerate,
  onRetry,
  isStreaming = false,
}) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const isUser = message.role === 'user';
  const isFailed = message.status === 'failed';

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(message.content);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end w-full my-3 animate-in fade-in duration-200">
        <div className="msg-user max-w-[80%] text-sm text-text-primary shadow-sm">
          <p className="whitespace-pre-wrap leading-relaxed m-0">{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex flex-col w-full my-4 animate-in fade-in duration-200 focus-within:outline-none">
      {/* Streaming Status Line (no box, muted text with pulsing accent dot) */}
      {isStreaming && (
        <div className="flex items-center gap-2 text-xs text-text-secondary py-1 font-mono mb-1">
          <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
          <span>Writing the answer...</span>
        </div>
      )}

      {/* Assistant Message: Plain text in column, no box, no border, no background */}
      {message.content ? (
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
                  <CodeBlock
                    language={match ? match[1] : ''}
                    code={String(children).replace(/\n$/, '')}
                  />
                );
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      ) : null}

      {/* Action Row: Small ghost icon buttons visible on hover/focus on desktop, always visible on mobile */}
      {!isStreaming && message.content && (
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

          {onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(message.id)}
              aria-label="Regenerate response"
              title="Regenerate response"
              className="rail-btn !w-7 !h-7 !rounded-lg text-text-tertiary hover:text-text-primary focus:outline-none"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}

          {isFailed && onRetry && (
            <button
              type="button"
              onClick={() => onRetry(message.id)}
              aria-label="Retry"
              title="Retry"
              className="rail-btn !w-7 !h-7 !rounded-lg text-status-error hover:text-status-error focus:outline-none"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
