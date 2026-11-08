import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PreferredModelSection } from '../../features/settings/PreferredModelSection';
import * as modelsHook from '../../features/models/hooks/useModels';
import * as defaultModelHook from '../../features/models/hooks/useDefaultModel';
import * as credentialsHook from '../../features/settings/hooks/useCredentials';

vi.mock('../../features/models/hooks/useModels');
vi.mock('../../features/models/hooks/useDefaultModel');
vi.mock('../../features/settings/hooks/useCredentials');
vi.mock('../../components/shared/Toast', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('PreferredModelSection Component', () => {
  const mockSetDefault = vi.fn().mockResolvedValue({ model_id: 'gemini-2.5-flash', valid: true, reason: null });
  const mockClearDefault = vi.fn().mockResolvedValue({ model_id: null, valid: true, reason: null });
  const mockRefresh = vi.fn().mockResolvedValue({});

  const sampleModels = [
    {
      id: 'gemini-2.5-flash',
      display_name: 'Gemini 2.5 Flash',
      provider: 'gemini',
      capabilities: ['chat'],
      input_token_limit: 1048576,
      output_token_limit: 8192,
      supported_actions: ['generateContent'],
      status: 'active',
      last_checked: '2026-11-08T10:00:00Z',
      kind: 'chat',
      kind_inferred: false,
    },
    {
      id: 'text-embedding-004',
      display_name: 'Embedding 004',
      provider: 'gemini',
      capabilities: ['embedContent'],
      input_token_limit: 2048,
      output_token_limit: null,
      supported_actions: ['embedContent'],
      status: 'active',
      last_checked: '2026-11-08T10:00:00Z',
      kind: 'embeddings',
      kind_inferred: false,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(credentialsHook.useCredentials).mockReturnValue({
      data: { configured: true, hint: '1234' },
      isLoading: false,
    } as unknown as ReturnType<typeof credentialsHook.useCredentials>);

    vi.mocked(modelsHook.useModels).mockReturnValue({
      data: {
        models: sampleModels,
        connected: true,
        default_chat_model: { model_id: null, valid: true, reason: null },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof modelsHook.useModels>);

    vi.mocked(modelsHook.useRefreshModelsMutation).mockReturnValue({
      mutateAsync: mockRefresh,
      isPending: false,
    } as unknown as ReturnType<typeof modelsHook.useRefreshModelsMutation>);

    vi.mocked(defaultModelHook.useSetDefaultModelMutation).mockReturnValue({
      mutateAsync: mockSetDefault,
      isPending: false,
    } as unknown as ReturnType<typeof defaultModelHook.useSetDefaultModelMutation>);

    vi.mocked(defaultModelHook.useClearDefaultModelMutation).mockReturnValue({
      mutateAsync: mockClearDefault,
      isPending: false,
    } as unknown as ReturnType<typeof defaultModelHook.useClearDefaultModelMutation>);
  });

  it('renders select with Automatic (recommended) and chat models only', () => {
    render(<PreferredModelSection />);

    const select = screen.getByLabelText('Preferred chat model');
    expect(select).toBeInTheDocument();

    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent('Automatic (recommended)');
    expect(options[1]).toHaveTextContent('Gemini 2.5 Flash (gemini-2.5-flash)');
  });

  it('choosing a model calls set-default mutation with modelId', async () => {
    render(<PreferredModelSection />);

    const select = screen.getByLabelText('Preferred chat model');
    fireEvent.change(select, { target: { value: 'gemini-2.5-flash' } });

    await waitFor(() => {
      expect(mockSetDefault).toHaveBeenCalledWith({ modelId: 'gemini-2.5-flash' });
    });
  });

  it('choosing Automatic calls clear-default mutation', async () => {
    vi.mocked(modelsHook.useModels).mockReturnValue({
      data: {
        models: sampleModels,
        connected: true,
        default_chat_model: { model_id: 'gemini-2.5-flash', valid: true, reason: null },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof modelsHook.useModels>);

    render(<PreferredModelSection />);

    const select = screen.getByLabelText('Preferred chat model');
    expect(select).toHaveValue('gemini-2.5-flash');

    fireEvent.change(select, { target: { value: '' } });

    await waitFor(() => {
      expect(mockClearDefault).toHaveBeenCalled();
    });
  });

  it('shows warning notice when saved preference is invalid', () => {
    vi.mocked(modelsHook.useModels).mockReturnValue({
      data: {
        models: sampleModels,
        connected: true,
        default_chat_model: {
          model_id: 'old-model-xyz',
          valid: false,
          reason: 'Model no longer supported',
        },
      },
      isLoading: false,
    } as unknown as ReturnType<typeof modelsHook.useModels>);

    render(<PreferredModelSection />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/Model no longer supported/i)).toBeInTheDocument();
  });

  it('shows hint to add Gemini API key when key is not configured', () => {
    vi.mocked(credentialsHook.useCredentials).mockReturnValue({
      data: { configured: false, hint: null },
      isLoading: false,
    } as unknown as ReturnType<typeof credentialsHook.useCredentials>);

    render(<PreferredModelSection />);

    expect(
      screen.getByText(/Add your Gemini API key above to load available models/i),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Preferred chat model')).toBeNull();
  });
});
