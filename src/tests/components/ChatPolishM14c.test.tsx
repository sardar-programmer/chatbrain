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

describe('M1.4c Chat Polish and Any-Answer Regeneration', () => {
  const convId = 'conv-polish-1';
  const mockMessages = [
    {
      id: 'u-1',
      conversation_id: convId,
      role: 'user' as const,
      content: 'Question 1',
      created_at: new Date(Date.now() - 30000).toISOString(),
      status: 'done' as const,
    },
    {
      id: 'a-1',
      conversation_id: convId,
      role: 'assistant' as const,
      content: 'Answer 1 to regenerate later',
      created_at: new Date(Date.now() - 25000).toISOString(),
      status: 'done' as const,
    },
    {
      id: 'u-2',
      conversation_id: convId,
      role: 'user' as const,
      content: 'Question 2',
      created_at: new Date(Date.now() - 20000).toISOString(),
      status: 'done' as const,
    },
    {
      id: 'a-2',
      conversation_id: convId,
      role: 'assistant' as const,
      content: 'Answer 2 (last answer)',
      created_at: new Date(Date.now() - 15000).toISOString(),
      status: 'done' as const,
    },
  ];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(clientModule, 'getConversation').mockResolvedValue({
      id: convId,
      title: 'Polish Conversation',
      pinned: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      messages: mockMessages,
    });
  });

  it('message column and composer container share the exact same max-w-3xl px-4 wrapper classes', async () => {
    const { container } = renderChatView(convId);
    await screen.findByText('Answer 1 to regenerate later');

    // Message column outer container has max-w-3xl px-4
    const messageColumn = container.querySelector('.max-w-3xl.mx-auto.px-4');
    expect(messageColumn).toBeInTheDocument();

    // Fixed composer inner wrapper also has max-w-3xl mx-auto px-4
    const composerWrappers = container.querySelectorAll('.max-w-3xl.mx-auto.px-4');
    expect(composerWrappers.length).toBeGreaterThanOrEqual(2);
  });

  it('regenerating the LAST assistant answer runs immediately without confirm dialog', async () => {
    const fetchSpy = vi.spyOn(sseModule, 'fetchReplyStream').mockResolvedValue({ terminal: true });
    renderChatView(convId);
    await screen.findByText('Answer 2 (last answer)');

    const regenButtons = screen.getAllByRole('button', { name: /regenerate response/i });
    expect(regenButtons.length).toBe(2);

    // Click last assistant answer's regenerate button
    fireEvent.click(regenButtons[1]);

    // Should NOT show confirm dialog
    expect(screen.queryByText(/The \d+ messages? after it will be removed/i)).not.toBeInTheDocument();

    // Directly sends { regenerate: true }
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        convId,
        { regenerate: true },
        expect.anything(),
      );
    });
  });

  it('regenerating an EARLIER assistant answer opens ConfirmDialog showing N messages to remove and sends {regenerate_from}', async () => {
    const fetchSpy = vi.spyOn(sseModule, 'fetchReplyStream').mockResolvedValue({ terminal: true });
    renderChatView(convId);
    await screen.findByText('Answer 1 to regenerate later');

    const regenButtons = screen.getAllByRole('button', { name: /regenerate response/i });
    // Click first assistant answer (a-1, which has u-2 and a-2 after it -> 2 messages)
    fireEvent.click(regenButtons[0]);

    // Confirm dialog must appear with N = 2 messages
    expect(
      await screen.findByText('Regenerate this answer? The 2 messages after it will be removed.'),
    ).toBeInTheDocument();

    // Click Regenerate in the dialog
    const confirmBtn = screen.getByRole('button', { name: /^Regenerate$/i });
    fireEvent.click(confirmBtn);

    // Sends { regenerate_from: 'a-1' }
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        convId,
        { regenerate_from: 'a-1' },
        expect.anything(),
      );
    });
  });
});
