/**
 * Pure mapping from backend/network error codes and categories to human-friendly UI text.
 * Never leaks raw JSON, stack traces, model names or API keys.
 */

export type ErrorActionType = 'retry' | 'settings' | 'none';

export interface ErrorDisplayInfo {
  message: string;
  action: ErrorActionType;
}

export function sanitizeMessage(raw?: string | null): string | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // If raw JSON or contains stack trace indicators, API keys or model names
  if (
    trimmed.startsWith('{') ||
    trimmed.startsWith('[') ||
    /traceback|exception:|error:/i.test(trimmed) ||
    /gemini|models\/|AIzaSy/i.test(trimmed)
  ) {
    return null;
  }
  return trimmed;
}

export function getErrorMessage(error?: {
  category?: string | null;
  code?: string | null;
  message?: string | null;
} | null): ErrorDisplayInfo {
  if (!error) {
    return {
      message: 'Something went wrong.',
      action: 'retry',
    };
  }

  const code = (error.code || '').toLowerCase().trim();
  const category = (error.category || '').toLowerCase().trim();

  // 1. All models unavailable
  if (code === 'all_models_unavailable') {
    return {
      message: "Chat-Brain couldn't reach a model right now. Your message is saved.",
      action: 'retry',
    };
  }

  // 2. Auth error (invalid_key or missing key)
  if (code === 'invalid_key' || code === 'missing_key' || category === 'auth') {
    return {
      message: 'Add your Gemini API key in Settings to start chatting.',
      action: 'settings',
    };
  }

  // 3. Empty model pool (category model or code empty_pool)
  if (category === 'model' || code === 'empty_pool') {
    return {
      message: 'No chat model is available for your API key. Check the key in Settings.',
      action: 'settings',
    };
  }

  // 4. Safety blocked
  if (code === 'safety_blocked') {
    return {
      message: "This message was blocked by Google's safety filters. Try rephrasing it.",
      action: 'none',
    };
  }

  // 5. Bad request (when not model category)
  if (code === 'bad_request') {
    return {
      message: "Chat-Brain couldn't process this request.",
      action: 'none',
    };
  }

  // 6. Quota, unavailable, timeout, network mid-reply
  if (
    code === 'quota' ||
    code === 'unavailable' ||
    code === 'timeout' ||
    code === 'network'
  ) {
    return {
      message: 'The answer was interrupted.',
      action: 'retry',
    };
  }

  // 7. Interrupted (stream ended without a result, backend unreachable / fetch failed)
  if (code === 'interrupted' || category === 'network') {
    return {
      message: 'Connection to Chat-Brain was lost. Make sure the app is running (npm run dev).',
      action: 'retry',
    };
  }

  // 8. Fallback to clean backend message if available, else generic unknown
  const sanitized = sanitizeMessage(error.message);
  if (sanitized) {
    return {
      message: sanitized,
      action: 'retry',
    };
  }

  return {
    message: 'Something went wrong.',
    action: 'retry',
  };
}
