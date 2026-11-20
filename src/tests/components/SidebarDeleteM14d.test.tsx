import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import * as Tooltip from '@radix-ui/react-tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Sidebar } from '../../components/layout/Sidebar';
import { ToastProvider } from '../../components/shared/Toast';
import { useUIStore } from '../../state/useUIStore';
import * as client from '../../services/api/client';

vi.mock('../../services/api/client', async () => {
  const actual = await vi.importActual<typeof client>('../../services/api/client');
  return {
    ...actual,
    listConversations: vi.fn(),
    updateConversation: vi.fn(),
    deleteConversation: vi.fn(),
    restoreConversation: vi.fn(),
  };
});

const LocationTracker: React.FC = () => {
  const location = useLocation();
  return <div data-testid="current-path">{location.pathname}</div>;
};

const makeItem = (id: string, title: string) => ({
  id, title, pinned: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

describe('M1.4d Sidebar Delete & Undo', () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    useUIStore.getState().setSidebarCollapsed(false);
  });

  afterEach(() => {
    testQueryClient.clear();
  });

  const renderWithProviders = (initialRoute = '/') =>
    render(
      <QueryClientProvider client={testQueryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[initialRoute]}>
            <Tooltip.Provider delayDuration={0}>
              <LocationTracker />
              <Routes>
                <Route path="*" element={<Sidebar />} />
              </Routes>
            </Tooltip.Provider>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>,
    );

  it('delete shows Undo toast; Undo calls restoreConversation', async () => {
    vi.mocked(client.listConversations).mockResolvedValue({
      items: [makeItem('c1', 'Chat To Delete')],
      next_cursor: null,
    });
    vi.mocked(client.deleteConversation).mockResolvedValue({ deleted: true });
    vi.mocked(client.restoreConversation).mockResolvedValue({
      id: 'c1', title: 'Chat To Delete', pinned: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [],
    });

    renderWithProviders();
    expect(await screen.findByText('Chat To Delete')).toBeInTheDocument();

    const trigger1 = screen.getByLabelText('Chat options');
    fireEvent.click(trigger1);
    fireEvent.click(await screen.findByText('Delete'));

    await waitFor(() => expect(client.deleteConversation).toHaveBeenCalledWith('c1'));

    expect(await screen.findByText('Conversation deleted')).toBeInTheDocument();
    const undoBtn = screen.getByText('Undo');

    fireEvent.click(undoBtn);
    expect(client.restoreConversation).toHaveBeenCalledWith('c1');
  });

  it('deleting the currently open chat navigates immediately to "/"', async () => {
    vi.mocked(client.listConversations).mockResolvedValue({
      items: [makeItem('c1', 'Open Chat')],
      next_cursor: null,
    });
    vi.mocked(client.deleteConversation).mockResolvedValue({ deleted: true });

    renderWithProviders('/chat/c1');
    expect(await screen.findByText('Open Chat')).toBeInTheDocument();
    expect(screen.getByTestId('current-path')).toHaveTextContent('/chat/c1');

    const trigger2 = screen.getByLabelText('Chat options');
    fireEvent.click(trigger2);
    fireEvent.click(await screen.findByText('Delete'));

    await waitFor(() =>
      expect(screen.getByTestId('current-path')).toHaveTextContent('/'),
    );
  });
});
