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

describe('M1.4d Sidebar Search & Rename', () => {
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

  it('renders search input in expanded mode and debounces query by 200ms', async () => {
    vi.mocked(client.listConversations).mockResolvedValue({
      items: [{ id: 'c1', title: 'ML Notes', pinned: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      next_cursor: null,
    });
    renderWithProviders();
    expect(await screen.findByText('ML Notes')).toBeInTheDocument();

    const inp = screen.getByPlaceholderText('Search chats...');
    fireEvent.change(inp, { target: { value: 'Deep' } });

    await waitFor(
      () => expect(client.listConversations).toHaveBeenCalledWith(expect.objectContaining({ search: 'Deep' })),
      { timeout: 1000 },
    );
  });

  it('shows "No chats match your search." on empty results; Escape clears search', async () => {
    vi.mocked(client.listConversations).mockImplementation(async opts => {
      const o = typeof opts === 'string' ? { search: opts } : (opts ?? {});
      if (o.search === 'nope') return { items: [], next_cursor: null };
      return { items: [{ id: 'c1', title: 'Chat 1', pinned: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }], next_cursor: null };
    });
    renderWithProviders();
    expect(await screen.findByText('Chat 1')).toBeInTheDocument();

    const inp = screen.getByPlaceholderText('Search chats...');
    fireEvent.change(inp, { target: { value: 'nope' } });
    expect(await screen.findByText('No chats match your search.')).toBeInTheDocument();

    fireEvent.keyDown(inp, { key: 'Escape' });
    expect(inp).toHaveValue('');
  });

  it('inline rename: empty rejected, Escape cancels without API, Enter saves valid title', async () => {
    vi.mocked(client.listConversations).mockResolvedValue({
      items: [{ id: 'c1', title: 'Original', pinned: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }],
      next_cursor: null,
    });
    vi.mocked(client.updateConversation).mockResolvedValue({
      id: 'c1', title: 'New Title', pinned: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), messages: [],
    });

    renderWithProviders();
    expect(await screen.findByText('Original')).toBeInTheDocument();

    // Open menu, click Rename
    const trigger1 = screen.getByLabelText('Chat options');
    fireEvent.click(trigger1);
    fireEvent.click(await screen.findByText('Rename'));

    const input = screen.getByDisplayValue('Original');
    // Escape cancels
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(client.updateConversation).not.toHaveBeenCalled();

    // Open again, type empty, press Enter → rejected
    const trigger2 = screen.getByLabelText('Chat options');
    fireEvent.click(trigger2);
    fireEvent.click(await screen.findByText('Rename'));
    const input2 = screen.getByDisplayValue('Original');
    fireEvent.change(input2, { target: { value: '   ' } });
    fireEvent.keyDown(input2, { key: 'Enter' });
    expect(client.updateConversation).not.toHaveBeenCalled();

    // Open again, type valid title, press Enter → saved
    const trigger3 = screen.getByLabelText('Chat options');
    fireEvent.click(trigger3);
    fireEvent.click(await screen.findByText('Rename'));
    const input3 = screen.getByDisplayValue('Original');
    fireEvent.change(input3, { target: { value: 'New Title' } });
    fireEvent.keyDown(input3, { key: 'Enter' });
    expect(client.updateConversation).toHaveBeenCalledWith('c1', { title: 'New Title' });
  });
});
