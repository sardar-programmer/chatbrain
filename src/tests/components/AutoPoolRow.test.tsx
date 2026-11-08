import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoPoolRow } from '../../features/models/AutoPoolRow';
import type { Model, ModelHealthItem } from '../../services/api/types';

describe('AutoPoolRow Component', () => {
  const dummyModel: Model = {
    id: 'gemini-2.5-flash',
    display_name: 'Gemini 2.5 Flash',
    provider: 'gemini',
    input_token_limit: 1048576,
    output_token_limit: 8192,
    capabilities: ['chat'],
    kind: 'chat',
    supported_actions: ['generateContent'],
    status: 'active',
    last_checked: '2026-11-08T10:00:00Z',
    kind_inferred: false,
  };

  const dummyHealth: ModelHealthItem = {
    model_id: 'gemini-2.5-flash',
    kind: 'chat',
    successes: 10,
    failures: 1,
    ttft_ms_ewma: 245.5,
    last_success_at: '2026-11-08T10:00:00Z',
    last_error_code: 'quota',
    consecutive_failures: 0,
    cooldown_until: null,
    in_cooldown: false,
    excluded: false,
  };

  it('renders model info, try order, and stats badge', () => {
    const handleToggle = vi.fn();
    render(
      <AutoPoolRow
        model={dummyModel}
        health={dummyHealth}
        isPreferred={false}
        isExcluded={false}
        tryOrder={1}
        now={new Date('2026-11-08T12:00:00Z')}
        onToggleExcluded={handleToggle}
        isToggling={false}
      />
    );

    expect(screen.getByText('Gemini 2.5 Flash')).toBeInTheDocument();
    expect(screen.getByText('gemini-2.5-flash')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('246 ms')).toBeInTheDocument();
    expect(screen.getByText(/Quota limit reached/i)).toBeInTheDocument();
  });

  it('calls onToggleExcluded with true when unchecking (excluding)', () => {
    const handleToggle = vi.fn();
    render(
      <AutoPoolRow
        model={dummyModel}
        health={dummyHealth}
        isPreferred={false}
        isExcluded={false}
        tryOrder={1}
        now={new Date('2026-11-08T12:00:00Z')}
        onToggleExcluded={handleToggle}
        isToggling={false}
      />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();

    fireEvent.click(toggle);
    expect(handleToggle).toHaveBeenCalledWith('gemini-2.5-flash', true);
  });

  it('calls onToggleExcluded with false when checking (including)', () => {
    const handleToggle = vi.fn();
    render(
      <AutoPoolRow
        model={dummyModel}
        health={dummyHealth}
        isPreferred={false}
        isExcluded={true}
        tryOrder={null}
        now={new Date('2026-11-08T12:00:00Z')}
        onToggleExcluded={handleToggle}
        isToggling={false}
      />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();

    fireEvent.click(toggle);
    expect(handleToggle).toHaveBeenCalledWith('gemini-2.5-flash', false);
  });

  it('disables the switch and shows tooltip when model is preferred', () => {
    const handleToggle = vi.fn();
    render(
      <AutoPoolRow
        model={dummyModel}
        health={dummyHealth}
        isPreferred={true}
        isExcluded={false}
        tryOrder={1}
        now={new Date('2026-11-08T12:00:00Z')}
        onToggleExcluded={handleToggle}
        isToggling={false}
      />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();

    const label = screen.getByText('In auto pool').closest('label');
    expect(label).toHaveAttribute(
      'title',
      'Clear the preferred model first to exclude it from the auto pool'
    );
    expect(screen.getByText('Preferred')).toBeInTheDocument();
  });

  it('disables the switch when isToggling is true', () => {
    const handleToggle = vi.fn();
    render(
      <AutoPoolRow
        model={dummyModel}
        health={dummyHealth}
        isPreferred={false}
        isExcluded={false}
        tryOrder={1}
        now={new Date('2026-11-08T12:00:00Z')}
        onToggleExcluded={handleToggle}
        isToggling={true}
      />
    );

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeDisabled();
  });
});
