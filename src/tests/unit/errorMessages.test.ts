import { describe, it, expect } from 'vitest';
import { getErrorMessage, sanitizeMessage } from '../../features/chat/errorMessages';

describe('errorMessages mapper', () => {
  const testCases: Array<{
    code?: string;
    category?: string;
    raw?: string;
    expectedText: string;
    expectedAction: 'retry' | 'settings' | 'none';
  }> = [
    {
      code: 'all_models_unavailable',
      category: 'provider',
      expectedText: "Chat-Brain couldn't reach a model right now. Your message is saved.",
      expectedAction: 'retry',
    },
    {
      code: 'invalid_key',
      category: 'auth',
      expectedText: 'Add your Gemini API key in Settings to start chatting.',
      expectedAction: 'settings',
    },
    {
      code: 'missing_key',
      category: 'auth',
      expectedText: 'Add your Gemini API key in Settings to start chatting.',
      expectedAction: 'settings',
    },
    {
      category: 'auth',
      expectedText: 'Add your Gemini API key in Settings to start chatting.',
      expectedAction: 'settings',
    },
    {
      code: 'empty_pool',
      category: 'model',
      expectedText: 'No chat model is available for your API key. Check the key in Settings.',
      expectedAction: 'settings',
    },
    {
      category: 'model',
      expectedText: 'No chat model is available for your API key. Check the key in Settings.',
      expectedAction: 'settings',
    },
    {
      code: 'safety_blocked',
      expectedText: "This message was blocked by Google's safety filters. Try rephrasing it.",
      expectedAction: 'none',
    },
    {
      code: 'bad_request',
      expectedText: "Chat-Brain couldn't process this request.",
      expectedAction: 'none',
    },
    {
      code: 'quota',
      expectedText: 'The answer was interrupted.',
      expectedAction: 'retry',
    },
    {
      code: 'unavailable',
      expectedText: 'The answer was interrupted.',
      expectedAction: 'retry',
    },
    {
      code: 'timeout',
      expectedText: 'The answer was interrupted.',
      expectedAction: 'retry',
    },
    {
      code: 'network',
      expectedText: 'The answer was interrupted.',
      expectedAction: 'retry',
    },
    {
      code: 'interrupted',
      expectedText:
        'Connection to Chat-Brain was lost. Make sure the app is running (npm run dev).',
      expectedAction: 'retry',
    },
    {
      category: 'network',
      expectedText:
        'Connection to Chat-Brain was lost. Make sure the app is running (npm run dev).',
      expectedAction: 'retry',
    },
  ];

  testCases.forEach(
    ({ code, category, raw, expectedText, expectedAction }) => {
      it(`maps code="${code}" category="${category}" to correct message and action`, () => {
        const result = getErrorMessage({
          code,
          category,
          message: raw,
        });
        expect(result.message).toBe(expectedText);
        expect(result.action).toBe(expectedAction);
      });
    },
  );

  it('falls back to sanitized backend message when clean', () => {
    const result = getErrorMessage({
      message: 'Custom user friendly server error explanation.',
    });
    expect(result.message).toBe('Custom user friendly server error explanation.');
    expect(result.action).toBe('retry');
  });

  it('sanitizes and rejects raw JSON strings', () => {
    expect(sanitizeMessage('{"error":"something"}')).toBeNull();
    const result = getErrorMessage({
      message: '{"error": {"code": 500, "message": "internal"}}',
    });
    expect(result.message).toBe('Something went wrong.');
    expect(result.action).toBe('retry');
  });

  it('sanitizes and rejects tracebacks and exceptions', () => {
    expect(sanitizeMessage('Traceback (most recent call last):\n  File ...')).toBeNull();
    expect(sanitizeMessage('Exception: connection reset by peer')).toBeNull();
    const result = getErrorMessage({
      message: 'Traceback (most recent call last): Exception: failed',
    });
    expect(result.message).toBe('Something went wrong.');
  });

  it('sanitizes and rejects API keys like AIzaSy...', () => {
    expect(sanitizeMessage('Invalid key AIzaSyD1234567890abcdef')).toBeNull();
    const result = getErrorMessage({
      message: 'Key AIzaSyABC123 was rejected',
    });
    expect(result.message).toBe('Something went wrong.');
  });

  it('never outputs model names in returned error text', () => {
    const dangerousMessages = [
      'Failed with model gemini-2.5-pro',
      'models/gemini-1.5-flash timed out',
      'No route to gemini-2.0-flash-exp',
    ];

    for (const msg of dangerousMessages) {
      expect(sanitizeMessage(msg)).toBeNull();
      const res = getErrorMessage({ message: msg });
      expect(res.message).not.toMatch(/gemini/i);
      expect(res.message).not.toMatch(/models\//i);
    }
  });

  it('handles null / undefined error gracefully', () => {
    const res = getErrorMessage(null);
    expect(res.message).toBe('Something went wrong.');
    expect(res.action).toBe('retry');
  });
});
