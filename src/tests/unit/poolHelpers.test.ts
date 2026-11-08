import { describe, expect, it } from 'vitest';
import type { ModelHealthItem } from '../../services/api/types';
import {
  deriveModelState,
  formatCountdown,
  formatTtft,
  friendlyErrorCode,
  summarize,
} from '../../features/models/poolHelpers';

describe('poolHelpers', () => {
  const baseHealth: ModelHealthItem = {
    model_id: 'test-model',
    kind: 'chat',
    successes: 5,
    failures: 1,
    ttft_ms_ewma: 820,
    consecutive_failures: 0,
    in_cooldown: false,
    cooldown_until: null,
    last_error_code: null,
    last_success_at: '2026-11-08T12:00:00Z',
    excluded: false,
  };

  describe('deriveModelState', () => {
    it('returns excluded when excluded flag is true', () => {
      expect(deriveModelState(baseHealth, true)).toBe('excluded');
      expect(deriveModelState(null, true)).toBe('excluded');
    });

    it('returns new when health is null or has zero activity', () => {
      expect(deriveModelState(null, false)).toBe('new');
      expect(
        deriveModelState(
          {
            ...baseHealth,
            successes: 0,
            failures: 0,
            ttft_ms_ewma: null,
          },
          false,
        ),
      ).toBe('new');
    });

    it('returns cooling when cooldown_until is in the future', () => {
      const now = new Date('2026-11-08T12:00:00Z');
      const coolingHealth: ModelHealthItem = {
        ...baseHealth,
        in_cooldown: true,
        cooldown_until: '2026-11-08T12:00:30Z',
      };
      expect(deriveModelState(coolingHealth, false, now)).toBe('cooling');
    });

    it('returns ready when cooldown_until is in the past', () => {
      const now = new Date('2026-11-08T12:01:00Z');
      const expiredHealth: ModelHealthItem = {
        ...baseHealth,
        in_cooldown: false,
        cooldown_until: '2026-11-08T12:00:30Z',
      };
      expect(deriveModelState(expiredHealth, false, now)).toBe('ready');
    });

    it('returns ready when healthy and active', () => {
      expect(deriveModelState(baseHealth, false)).toBe('ready');
    });
  });

  describe('formatCountdown', () => {
    it('returns 0s for missing or invalid dates', () => {
      expect(formatCountdown(null)).toBe('0s');
      expect(formatCountdown('')).toBe('0s');
      expect(formatCountdown('invalid-date')).toBe('0s');
    });

    it('returns 0s for past dates', () => {
      const now = new Date('2026-11-08T12:00:00Z');
      expect(formatCountdown('2026-11-08T11:59:50Z', now)).toBe('0s');
    });

    it('formats seconds when under 60 seconds', () => {
      const now = new Date('2026-11-08T12:00:00Z');
      expect(formatCountdown('2026-11-08T12:00:45Z', now)).toBe('45s');
    });

    it('formats minutes and seconds when >= 60 seconds', () => {
      const now = new Date('2026-11-08T12:00:00Z');
      expect(formatCountdown('2026-11-08T12:02:15Z', now)).toBe('2m 15s');
    });
  });

  describe('formatTtft', () => {
    it('returns dash for null or undefined', () => {
      expect(formatTtft(null)).toBe('—');
      expect(formatTtft(undefined)).toBe('—');
      expect(formatTtft(NaN)).toBe('—');
    });

    it('formats milliseconds under 1000ms', () => {
      expect(formatTtft(820)).toBe('820 ms');
      expect(formatTtft(45.4)).toBe('45 ms');
    });

    it('formats seconds for >= 1000ms', () => {
      expect(formatTtft(1400)).toBe('1.4 s');
      expect(formatTtft(2000)).toBe('2.0 s');
    });
  });

  describe('friendlyErrorCode', () => {
    it('maps known error codes to friendly human-readable strings', () => {
      expect(friendlyErrorCode('quota')).toBe('Quota limit reached');
      expect(friendlyErrorCode('unavailable')).toBe('Server busy');
      expect(friendlyErrorCode('timeout')).toBe('Too slow to respond');
      expect(friendlyErrorCode('network')).toBe('Network problem');
      expect(friendlyErrorCode('not_found')).toBe('Model not available');
      expect(friendlyErrorCode('other')).toBe('Unknown error');
      expect(friendlyErrorCode(null)).toBe('Unknown error');
    });
  });

  describe('summarize', () => {
    it('correctly aggregates chat models into ready, cooling, and excluded counts', () => {
      const now = new Date('2026-11-08T12:00:00Z');
      const testModels = [
        { kind: 'chat', excluded: false, in_cooldown: false },
        { kind: 'chat', excluded: false, in_cooldown: true, cooldown_until: '2026-11-08T12:00:30Z' },
        { kind: 'chat', excluded: true },
        { kind: 'embeddings', excluded: false },
      ];

      const counts = summarize(testModels, now);
      expect(counts).toEqual({
        chat_model_count: 3,
        ready_count: 1,
        cooling_count: 1,
        excluded_count: 1,
      });
    });
  });
});
