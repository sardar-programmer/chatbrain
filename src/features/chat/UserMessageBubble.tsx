import React, { useState, useRef, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { type MessageItem } from '../../services/api/types';

interface UserMessageBubbleProps {
  message: MessageItem;
  isStreaming?: boolean;
  onRequestEdit?: (messageId: string, newContent: string) => void;
}

export const UserMessageBubble: React.FC<UserMessageBubbleProps> = ({
  message,
  isStreaming = false,
  onRequestEdit,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing) {
      setDraft(message.content);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(message.content.length, message.content.length);
      }
    }
  }, [isEditing, message.content]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleCancel = () => {
    setDraft(message.content);
    setIsEditing(false);
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed === message.content.trim()) {
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    onRequestEdit?.(message.id, trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="w-full my-3 flex justify-end animate-in fade-in duration-200">
        <div className="w-full max-w-2xl rounded-2xl glass-composer p-3 border border-border/80 shadow-md flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full resize-none bg-transparent text-sm leading-relaxed text-text-primary focus:outline-none focus:ring-0 border-0 p-0 placeholder:text-text-tertiary"
            placeholder="Edit message..."
          />
          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/20">
            <button
              type="button"
              onClick={handleCancel}
              className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-white/10 dark:hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!draft.trim() || isStreaming}
              className="btn-send px-3 py-1.5 text-xs font-medium text-white rounded-lg shadow-sm disabled:opacity-50 transition-all cursor-pointer"
            >
              Save & resend
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative flex justify-end items-center gap-1.5 w-full my-3 animate-in fade-in duration-200">
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        disabled={isStreaming}
        aria-label="Edit message"
        className="rail-btn h-7 w-7 p-0 shrink-0 rounded text-text-tertiary hover:text-text-primary opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center cursor-pointer"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <div className="msg-user max-w-[80%] text-sm text-text-primary shadow-sm">
        <p className="whitespace-pre-wrap leading-relaxed m-0">{message.content}</p>
      </div>
    </div>
  );
};
