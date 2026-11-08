/**
 * Pure helper functions for auto-pool states, countdowns, formatting, and summaries.
 */

import type { ModelHealthItem } from '../../services/api/types';

export type ModelState = 'ready' | 'cooling' | 'excluded' | 'new';

export function deriveModelState(
  health: ModelHealthItem | null | undefined,
  excluded: boolean,
  now: Date = new Date(),
): ModelState {
  if (excluded) {
    return 'excluded';
  }

  if (
    !health ||
    (health.successes === 0 && health.failures === 0 && health.ttft_ms_ewma === null)
  ) {
    return 'new';
  }

  if (health.cooldown_until) {
    const expiry = new Date(health.cooldown_until);
    if (!isNaN(expiry.getTime()) && expiry.getTime() > now.getTime()) {
      return 'cooling';
    }
  } else if (health.in_cooldown) {
    return 'cooling';
  }

  return 'ready';
}

export function formatCountdown(
  cooldownUntil: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!cooldownUntil) {
    return '0s';
  }

  const expiry = new Date(cooldownUntil);
  if (isNaN(expiry.getTime())) {
    return '0s';
  }

  const diffSec = Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 1000));
  if (diffSec <= 0) {
    return '0s';
  }

  if (diffSec < 60) {
    return `${diffSec}s`;
  }

  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${mins}m ${secs}s`;
}

export function formatTtft(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) {
    return '—';
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  const sec = (ms / 1000).toFixed(1);
  return `${sec} s`;
}

export function friendlyErrorCode(code: string | null | undefined): string {
  switch (code) {
    case 'quota':
      return 'Quota limit reached';
    case 'unavailable':
      return 'Server busy';
    case 'timeout':
      return 'Too slow to respond';
    case 'network':
      return 'Network problem';
    case 'not_found':
      return 'Model not available';
    default:
      return 'Unknown error';
  }
}

export interface SummaryCounts {
  chat_model_count: number;
  ready_count: number;
  cooling_count: number;
  excluded_count: number;
}

export function summarize(
  models: Array<{
    kind?: string;
    excluded?: boolean;
    in_cooldown?: boolean;
    cooldown_until?: string | null;
  }>,
  now: Date = new Date(),
): SummaryCounts {
  const chatModels = models.filter(m => !m.kind || m.kind === 'chat');
  const chatCount = chatModels.length;
  let excludedCount = 0;
  let coolingCount = 0;

  for (const m of chatModels) {
    if (m.excluded) {
      excludedCount += 1;
    } else {
      const isCooling = m.cooldown_until
        ? new Date(m.cooldown_until).getTime() > now.getTime()
        : Boolean(m.in_cooldown);
      if (isCooling) {
        coolingCount += 1;
      }
    }
  }

  const readyCount = Math.max(0, chatCount - excludedCount - coolingCount);

  return {
    chat_model_count: chatCount,
    ready_count: readyCount,
    cooling_count: coolingCount,
    excluded_count: excludedCount,
  };
}
