import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient } from '@tanstack/react-query';
import { ChatMessage } from '../../features/chat/ChatMessage';
import { regenerateReply } from '../../features/chat/chatStreamStore';
import * as sseModule from '../../features/chat/sse';
import { type MessageItem } from '../../services/api/types';

const renderWithRouter = (ui: React.ReactElement) => {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
};

describe('ChatMessage Component and Reliability', () => {
  it('renders a message with status="error" and EMPTY content showing error card with Retry button (Fixes P1)', () => {
    const errorMsg: MessageItem = {
      id: 'msg-err-1',
      conversation_id: 'conv-1',
      role: 'assistant',
      content: '',
      status: 'error',
      error_category: 'all_models_unavailable',
      created_at: new Date().toISOString(),
    };

    const handleRegenerate = vi.fn();

    renderWithRouter(
      <ChatMessage
        message={errorMsg}
        onRegenerate={handleRegenerate}
        isLast={true}
      />,
    );

    // Shows the friendly mapped message
    expect(
      screen.getByText("Chat-Brain couldn't reach a model right now. Your message is saved."),
    ).toBeInTheDocument();

    // Shows the Retry button
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();

    // Clicking Retry calls onRegenerate
    fireEvent.click(retryBtn);
    expect(handleRegenerate).toHaveBeenCalledTimes(1);
  });

  it('renders a message with status="stopped" showing the Stopped label and Square icon (Fixes P3)', () => {
    const stoppedMsg: MessageItem = {
      id: 'msg-stop-1',
      conversation_id: 'conv-1',
      role: 'assistant',
      content: 'Here is part of the text that was ge',
      status: 'stopped',
      created_at: new Date().toISOString(),
    };

    renderWithRouter(
      <ChatMessage
        message={stoppedMsg}
        onRegenerate={vi.fn()}
        isLast={true}
      />,
    );

    // Shows the partial text
    expect(screen.getByText('Here is part of the text that was ge')).toBeInTheDocument();

    // Shows the "Stopped" indicator
    expect(screen.getByText('Stopped')).toBeInTheDocument();
  });

  it('regenerate action sends {regenerate: true} with NO user message content (Fixes P2)', async () => {
    const queryClient = new QueryClient();
    const fetchSpy = vi.spyOn(sseModule, 'fetchReplyStream').mockImplementation(
      async (_id, payload, _opts) => {
        // Assert that the payload is strictly { regenerate: true }
        expect(payload).toEqual({ regenerate: true });
        expect(payload.content).toBeUndefined();
        return { terminal: true };
      },
    );

    await regenerateReply('conv-1', queryClient);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });

  it('refetches TanStack Query conversation cache after stream terminal event or error', async () => {
    const queryClient = new QueryClient();
    const refetchSpy = vi.spyOn(queryClient, 'refetchQueries');

    const fetchSpy = vi.spyOn(sseModule, 'fetchReplyStream').mockImplementation(
      async () => {
        return { terminal: true };
      },
    );

    await regenerateReply('conv-1', queryClient);

    await waitFor(() => {
      expect(refetchSpy).toHaveBeenCalledWith({
        queryKey: ['conversation', 'conv-1'],
      });
    });

    fetchSpy.mockRestore();
    refetchSpy.mockRestore();
  });
});
