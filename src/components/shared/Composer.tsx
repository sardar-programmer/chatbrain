import React, { useState, useRef, useEffect } from 'react';
import { ArrowUp, Plus, Mic, X, Square } from 'lucide-react';
import { NavTooltip } from '../layout/NavTooltip';

export interface ComposerAttachment {
  id: string;
  name: string;
  size: number;
}

interface ComposerProps {
  placeholder?: string;
  onSubmit?: (content: string, attachments: ComposerAttachment[]) => void;
  isStreaming?: boolean;
  onStop?: () => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

export const Composer: React.FC<ComposerProps> = ({
  placeholder = 'Ask anything or request data analysis...',
  onSubmit,
  isStreaming = false,
  onStop,
  disabled = false,
  className = '',
  autoFocus = false,
}) => {
  const [content, setContent] = useState('');
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!trimmed && attachments.length === 0) return;
    if (disabled || isStreaming) return;

    onSubmit?.(trimmed, attachments);
    setContent('');
    setAttachments([]);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newAttachments: ComposerAttachment[] = Array.from(files).map(f => ({
      id: Math.random().toString(36).substring(2, 9),
      name: f.name,
      size: f.size,
    }));

    setAttachments(prev => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const canSend = (content.trim().length > 0 || attachments.length > 0) && !disabled;

  return (
    <div className={`w-full max-w-2xl mx-auto ${className}`}>
      {/* Composer Card with hairline border and zero focus rings */}
      <div className="relative rounded-composer border border-border/80 bg-surface px-4 pt-3 pb-2 shadow-subtle transition-colors focus-within:border-border">
        {/* Attachment Chips */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2 pb-2 border-b border-border/40">
            {attachments.map(att => (
              <span
                key={att.id}
                className="inline-flex items-center gap-1.5 rounded-md bg-sidebar px-2 py-0.5 text-[11px] text-text-secondary border border-border/50 select-none"
              >
                <span className="truncate max-w-[140px] font-medium">{att.name}</span>
                <span className="text-[10px] text-text-tertiary">({formatFileSize(att.size)})</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.id)}
                  className="text-text-tertiary hover:text-text-primary focus:outline-none"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <span className="text-[11px] text-text-tertiary italic ml-1">
              Attachments are not processed yet
            </span>
          </div>
        )}

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
          {/* Left Action Tools */}
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
            <NavTooltip content="Attach file (UI only)">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                aria-label="Attach file"
                className="flex h-7 w-7 items-center justify-center rounded-full text-text-tertiary hover:bg-sidebar-accent hover:text-text-primary transition-colors focus:outline-none"
              >
                <Plus className="h-4 w-4 stroke-[2]" />
              </button>
            </NavTooltip>

            <NavTooltip content="Voice dictation (Coming later)">
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

          {/* Right Action: Circular Accent Send / Stop button */}
          <div className="flex items-center">
            {isStreaming ? (
              <NavTooltip content="Stop generating">
                <button
                  type="button"
                  onClick={onStop}
                  aria-label="Stop generation"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-accent hover:bg-accent-hover text-white transition-all shadow-sm focus:outline-none active:scale-95"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              </NavTooltip>
            ) : (
              <NavTooltip content={canSend ? 'Send message (Enter)' : 'Type a message'}>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!canSend}
                  aria-label="Send message"
                  className={`flex h-8 w-8 items-center justify-center rounded-full transition-all focus:outline-none ${
                    canSend
                      ? 'bg-accent hover:bg-accent-hover text-white shadow-sm active:scale-95 cursor-pointer'
                      : 'bg-text-tertiary/20 text-text-tertiary cursor-not-allowed opacity-50'
                  }`}
                >
                  <ArrowUp className="h-4 w-4 stroke-[2.2]" />
                </button>
              </NavTooltip>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
