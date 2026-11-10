import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Composer } from '../../components/shared/Composer';

const renderWithTooltip = (ui: React.ReactElement) => {
  return render(<Tooltip.Provider delayDuration={0}>{ui}</Tooltip.Provider>);
};

describe('Composer Component', () => {
  it('renders with placeholder and send button', () => {
    renderWithTooltip(<Composer placeholder="Type message..." />);
    expect(screen.getByPlaceholderText('Type message...')).toBeInTheDocument();
    expect(screen.getByLabelText('Send message')).toBeInTheDocument();
  });

  it('enables send button when content is typed', () => {
    renderWithTooltip(<Composer />);
    const textarea = screen.getByPlaceholderText('Ask anything about data science, Python or SQL...');
    const sendButton = screen.getByLabelText('Send message');

    expect(sendButton).toBeDisabled();

    fireEvent.change(textarea, { target: { value: 'Hello world' } });
    expect(sendButton).toBeEnabled();
  });

  it('calls onSubmit on Enter without shift', () => {
    const handleSubmit = vi.fn();
    renderWithTooltip(<Composer onSubmit={handleSubmit} />);
    const textarea = screen.getByPlaceholderText('Ask anything about data science, Python or SQL...');

    fireEvent.change(textarea, { target: { value: 'Test message' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(handleSubmit).toHaveBeenCalledWith('Test message', []);
  });

  it('does not submit on Shift+Enter', () => {
    const handleSubmit = vi.fn();
    renderWithTooltip(<Composer onSubmit={handleSubmit} />);
    const textarea = screen.getByPlaceholderText('Ask anything about data science, Python or SQL...');

    fireEvent.change(textarea, { target: { value: 'Line 1' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });

    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
