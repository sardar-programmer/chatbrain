import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Mic, Plus, Square } from 'lucide-react';
import { NavTooltip } from '../layout/NavTooltip';

export interface ComposerAttachment {
  id: string;
  name: string;
  size: number;
}

interface ComposerProps {
  placeholder?: string;
  initialValue?: string;
  onSubmit?: (content: string, attachments: ComposerAttachment[]) => void;
  isStreaming?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  placeholder = 'Ask anything about data science, Python or SQL...',
  initialValue,
  onSubmit,
  isStreaming = false,
  onStop,
  disabled = false,
  className = '',
  autoFocus = false,
}) => {
  const [content, setContent] = useState(initialValue || '');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus and populate when initialValue changes (e.g. prompt chips)
  useEffect(() => {
    if (initialValue !== undefined) {
      setContent(initialValue);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    }
  }, [initialValue]);

  // Auto-grow textarea up to ~8 lines (~192px)
  const adjustHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const newHeight = Math.min(el.scrollHeight, 192);
    el.style.height = `${Math.max(24, newHeight)}px`;
  };

  useEffect(() => {
    adjustHeight();
  }, [content]);

  const handleSend = () => {
    const trimmed = content.trim();
    if (!trimmed || disabled || isStreaming) return;

    onSubmit?.(trimmed, []);
    setContent('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canSend = content.trim().length > 0 && !disabled;

  return (
    <div className={`w-full max-w-2xl mx-auto bg-transparent ${className}`}>
      {/* Floating Glass Container */}
      <div className="glass-composer px-5 pt-4 pb-3 focus-within:outline-none">
        {/* Dynamic Auto-growing Textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled || isStreaming}
          autoFocus={autoFocus}
          rows={1}
          className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-0 border-0 p-0 resize-none leading-relaxed min-h-[26px] max-h-[192px] overflow-y-auto"
        />

        {/* Bottom Controls Row */}
        <div className="flex items-center justify-between pt-2">
          {/* Left Action Tools: Disabled with "Coming later" tooltips */}
          <div className="flex items-center gap-2">
            <NavTooltip content="Coming later">
              <button
                type="button"
                disabled
                aria-label="Add attachment"
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary/40 cursor-not-allowed focus:outline-none"
              >
                <Plus className="h-4 w-4 stroke-[2]" />
              </button>
            </NavTooltip>

            <NavTooltip content="Coming later">
              <button
                type="button"
                disabled
                aria-label="Voice input"
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary/40 cursor-not-allowed focus:outline-none"
              >
                <Mic className="h-3.5 w-3.5 stroke-[1.75]" />
              </button>
            </NavTooltip>
          </div>

          {/* Right Action: Send / Stop button */}
          <div className="flex items-center">
            {isStreaming ? (
              <NavTooltip content="Stop generating">
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop generation"
                  className="btn-send focus:outline-none cursor-pointer"
                >
                  <Square className="h-4 w-4 fill-current" />
                </button>
              </NavTooltip>
            ) : (
              <NavTooltip content={canSend ? 'Send message (Enter)' : 'Type a message'}>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                  className="btn-send focus:outline-none"
                >
                  <ArrowUp className="h-4 w-4 stroke-[2.5]" />
                </button>
              </NavTooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
