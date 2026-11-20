import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { UserMessageBubble } from '../../features/chat/UserMessageBubble';
import { type MessageItem } from '../../services/api/types';

const baseMsg = (content: string): MessageItem => ({
  id: 'msg-1',
  conversation_id: 'conv-1',
  role: 'user',
  content,
  created_at: new Date().toISOString(),
  status: 'done',
});

describe('M1.4d Edit & Resend — UserMessageBubble', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Edit icon button that is disabled while streaming', () => {
    const { rerender } = render(
      <UserMessageBubble message={baseMsg('Hello')} isStreaming={false} />,
    );
    expect(screen.getByLabelText('Edit message')).not.toBeDisabled();

    rerender(
      <UserMessageBubble message={baseMsg('Hello')} isStreaming={true} />,
    );
    expect(screen.getByLabelText('Edit message')).toBeDisabled();
  });

  it('clicking Edit switches to textarea pre-filled with the message; Escape cancels', () => {
    render(<UserMessageBubble message={baseMsg('Original text')} />);
    fireEvent.click(screen.getByLabelText('Edit message'));

    const textarea = screen.getByPlaceholderText('Edit message...');
    expect(textarea).toBeInTheDocument();
    expect((textarea as HTMLTextAreaElement).value).toBe('Original text');

    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('Edit message...')).toBeNull();
    expect(screen.getByText('Original text')).toBeInTheDocument();
  });

  it('unchanged content (same after trim) closes the editor without calling onRequestEdit', () => {
    const onEdit = vi.fn();
    render(<UserMessageBubble message={baseMsg('Same')} onRequestEdit={onEdit} />);
    fireEvent.click(screen.getByLabelText('Edit message'));

    const textarea = screen.getByPlaceholderText('Edit message...');
    fireEvent.change(textarea, { target: { value: 'Same' } });
    fireEvent.click(screen.getByText('Save & resend'));

    expect(onEdit).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText('Edit message...')).toBeNull();
  });

  it('changed content calls onRequestEdit with new content on "Save & resend"', () => {
    const onEdit = vi.fn();
    render(<UserMessageBubble message={baseMsg('Old text')} onRequestEdit={onEdit} />);
    fireEvent.click(screen.getByLabelText('Edit message'));

    const textarea = screen.getByPlaceholderText('Edit message...');
    fireEvent.change(textarea, { target: { value: 'Updated text' } });
    fireEvent.click(screen.getByText('Save & resend'));

    expect(onEdit).toHaveBeenCalledOnce();
    expect(onEdit).toHaveBeenCalledWith('msg-1', 'Updated text');
  });

  it('Ctrl+Enter saves and calls onRequestEdit', () => {
    const onEdit = vi.fn();
    render(<UserMessageBubble message={baseMsg('Hello')} onRequestEdit={onEdit} />);
    fireEvent.click(screen.getByLabelText('Edit message'));

    const textarea = screen.getByPlaceholderText('Edit message...');
    fireEvent.change(textarea, { target: { value: 'Updated via Ctrl+Enter' } });
    fireEvent.keyDown(textarea, { key: 'Enter', ctrlKey: true });

    expect(onEdit).toHaveBeenCalledWith('msg-1', 'Updated via Ctrl+Enter');
  });

  it('empty / whitespace-only edit does not call onRequestEdit', () => {
    const onEdit = vi.fn();
    render(<UserMessageBubble message={baseMsg('Has content')} onRequestEdit={onEdit} />);
    fireEvent.click(screen.getByLabelText('Edit message'));

    const textarea = screen.getByPlaceholderText('Edit message...');
    fireEvent.change(textarea, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Save & resend'));

    expect(onEdit).not.toHaveBeenCalled();
  });
});
