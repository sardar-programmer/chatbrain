import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Tooltip from '@radix-ui/react-tooltip';
import { ChatView } from '../../features/chat/ChatView';
import * as clientModule from '../../services/api/client';
import * as sseModule from '../../features/chat/sse';
import { ToastProvider } from '../../components/shared/Toast';

const renderChatView = (convId: string) => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={0}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/chat/${convId}`]}>
            <Routes>
              <Route path="/chat/:id" element={<ChatView />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </Tooltip.Provider>
    </QueryClientProvider>,
  );
};

describe('M1.4b Chat Reliability and Unanswered State', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders soft "No reply yet." panel when last message is user and no assistant reply exists', async () => {
    const convId = 'conv-unanswered-1';
    vi.spyOn(clientModule, 'getConversation').mockResolvedValue({
      id: convId,
      title: 'Test Conversation',
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: 'u-1',
          conversation_id: convId,
          role: 'user',
          content: 'Why is linear regression useful?',
          created_at: new Date().toISOString(),
          status: 'done',
        },
      ],
    });

    renderChatView(convId);

    // Expect user message
    expect(await screen.findByText('Why is linear regression useful?')).toBeInTheDocument();

    // Expect "No reply yet." panel
    expect(await screen.findByText('No reply yet.')).toBeInTheDocument();

    // Expect Retry button
    const retryBtn = screen.getByRole('button', { name: /retry/i });
    expect(retryBtn).toBeInTheDocument();
  });

  it('clicking Retry in "No reply yet." sends {regenerate: true} with NO user message content', async () => {
    const convId = 'conv-unanswered-2';
    vi.spyOn(clientModule, 'getConversation').mockResolvedValue({
      id: convId,
      title: 'Test Conversation',
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: 'u-2',
          conversation_id: convId,
          role: 'user',
          content: 'What is overfitting?',
          created_at: new Date().toISOString(),
          status: 'done',
        },
      ],
    });

    const fetchSpy = vi.spyOn(sseModule, 'fetchReplyStream').mockImplementation(
      async (_id, payload) => {
        expect(payload).toEqual({ regenerate: true });
        expect(payload.content).toBeUndefined();
        return { terminal: true };
      },
    );

    renderChatView(convId);

    const retryBtn = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error panel under user message when error occurred before reply started (e.g. auth / missing key)', async () => {
    const convId = 'conv-err-auth';
    vi.spyOn(clientModule, 'getConversation').mockResolvedValue({
      id: convId,
      title: 'Auth Test',
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: [
        {
          id: 'u-auth',
          conversation_id: convId,
          role: 'user',
          content: 'Hello without key',
          created_at: new Date().toISOString(),
          status: 'done',
        },
      ],
    });

    // Simulate backend SSE error before assistant reply exists
    vi.spyOn(sseModule, 'fetchReplyStream').mockImplementation(
      async (_id, _payload, opts) => {
        opts.onEvent({
          event: 'error',
          data: {
            category: 'auth',
            code: 'invalid_key',
            message: 'Add your Gemini API key first',
            retryable: false,
            message_id: null,
          },
        });
        return { terminal: true };
      },
    );

    renderChatView(convId);

    // Initial render shows "No reply yet."
    const retryBtn = await screen.findByRole('button', { name: /retry/i });
    fireEvent.click(retryBtn);

    // After auth error, error card with "Add your Gemini API key in Settings..." appears
    expect(
      await screen.findByText('Add your Gemini API key in Settings to start chatting.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /open settings/i })).toBeInTheDocument();
  });
});
