import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, RotateCcw, Sparkles, User } from 'lucide-react';
import { MessageItem } from '../../services/api/types';

interface ChatMessageProps {
  message: MessageItem;
  onRegenerate?: (messageId: string) => void;
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
  isStreaming = false,
}) => {
  const [copiedResponse, setCopiedResponse] = useState(false);
  const isUser = message.role === 'user';

  const handleCopyResponse = () => {
    navigator.clipboard.writeText(message.content);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  if (isUser) {
    return (
      <div className="flex justify-end w-full my-3 animate-in fade-in duration-200">
        <div className="flex gap-2.5 max-w-[85%] sm:max-w-[75%] items-start">
          <div className="rounded-2xl rounded-tr-sm bg-gradient-to-br from-accent/15 via-accent/08 to-accent/04 dark:from-accent/25 dark:via-accent/15 dark:to-accent/08 border border-accent/25 px-4 py-3 text-sm text-text-primary shadow-sm backdrop-blur-md">
            <p className="whitespace-pre-wrap leading-relaxed m-0">{message.content}</p>
          </div>
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface/80 dark:bg-surface/50 border border-border/50 text-text-secondary shadow-sm mt-0.5">
            <User className="h-4 w-4 stroke-[1.75]" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full my-4 animate-in fade-in duration-200">
      <div className="flex gap-3 w-full items-start">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-hover text-white shadow-sm mt-0.5">
          <Sparkles className="h-4 w-4 stroke-[2]" />
        </div>

        <div className="flex-1 min-w-0 rounded-2xl bg-surface/50 dark:bg-surface/30 border border-white/70 dark:border-white/08 p-4 sm:p-5 text-text-primary backdrop-blur-md shadow-sm">
          {/* Header row */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-text-primary">Chat-Brain AI</span>
              {message.model_used && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface/80 dark:bg-surface/50 border border-border/40 text-text-tertiary">
                  {message.model_used}
                </span>
              )}
            </div>
            {isStreaming && (
              <span className="flex items-center gap-1.5 text-[11px] text-accent font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-accent animate-ping" />
                Thinking...
              </span>
            )}
          </div>

          {/* Markdown Content */}
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm leading-relaxed overflow-hidden">
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

          {/* Action Row */}
          {!isStreaming && (
            <div className="flex items-center gap-2 pt-3 mt-3 border-t border-border/30 text-text-tertiary">
              <button
                type="button"
                onClick={handleCopyResponse}
                aria-label="Copy response"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none"
              >
                {copiedResponse ? (
                  <Check className="h-3.5 w-3.5 text-status-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedResponse ? 'Copied' : 'Copy'}</span>
              </button>

              {onRegenerate && (
                <button
                  type="button"
                  onClick={() => onRegenerate(message.id)}
                  aria-label="Regenerate response"
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Regenerate</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
