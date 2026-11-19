/**
 * Pure SSE Parser and reply streaming fetcher.
 * Handles CRLF, chunk boundaries, joined data lines, ping comments, and safe JSON parsing.
 */

import { getBootstrapToken } from '../../services/api/client';
import { ApiError } from '../../services/api/types';

export type SSEEvent =
  | {
      event: 'message_created';
      data: { user_message_id: string | null; assistant_message_id: string };
    }
  | {
      event: 'status';
      data: {
        phase: 'preparing' | 'connecting' | 'waiting_first_token' | 'writing' | 'retrying';
        text: string;
        attempt?: number;
        retry_in_seconds?: number;
      };
    }
  | { event: 'delta'; data: { text: string } }
  | { event: 'done'; data: { message_id: string; status: string } }
  | {
      event: 'error';
      data: {
        category: string;
        code: string;
        message: string;
        retryable: boolean;
        message_id: string | null;
      };
    }
  | { event: 'stopped'; data: { message_id: string } };

export function parseSSEBlock(block: string): SSEEvent | null {
  const lines = block.split('\n');
  let eventType = 'message';
  const dataLines: string[] = [];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith(':')) {
      // Ignore empty lines and comment lines (e.g. ": ping")
      continue;
    }

    if (rawLine.startsWith('event:')) {
      eventType = rawLine.slice(6).trim();
    } else if (rawLine.startsWith('data:')) {
      const dataContent = rawLine.startsWith('data: ')
        ? rawLine.slice(6)
        : rawLine.slice(5);
      dataLines.push(dataContent);
    }
  }

  if (dataLines.length === 0) return null;
  const fullData = dataLines.join('\n');

  try {
    const parsed = JSON.parse(fullData);
    return { event: eventType as SSEEvent['event'], data: parsed } as SSEEvent;
  } catch {
    // Malformed JSON must not crash the stream
    return null;
  }
}

export async function parseSSEStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (evt: SSEEvent) => void,
): Promise<{ terminal: boolean; lastEvent?: string }> {
  const reader = stream.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let terminal = false;
  let lastEvent: string | undefined;

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const blocks = buffer.split('\n\n');
      buffer = blocks.pop() ?? '';

      for (const block of blocks) {
        const event = parseSSEBlock(block);
        if (event) {
          lastEvent = event.event;
          if (
            event.event === 'done' ||
            event.event === 'error' ||
            event.event === 'stopped'
          ) {
            terminal = true;
          }
          onEvent(event);
        }
      }
    }

    // Flush remaining buffer
    buffer += decoder.decode();
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (buffer.trim()) {
      const event = parseSSEBlock(buffer);
      if (event) {
        lastEvent = event.event;
        if (
          event.event === 'done' ||
          event.event === 'error' ||
          event.event === 'stopped'
        ) {
          terminal = true;
        }
        onEvent(event);
      }
    }
  } finally {
    reader.releaseLock();
  }

  return { terminal, lastEvent };
}

export interface FetchReplyOptions {
  signal?: AbortSignal;
  onEvent: (evt: SSEEvent) => void;
}

export async function fetchReplyStream(
  conversationId: string,
  payload: { content?: string; regenerate?: boolean },
  options: FetchReplyOptions,
): Promise<{ terminal: boolean }> {
  const execute = async (tokenOverride?: string): Promise<Response> => {
    const token = tokenOverride ?? (await getBootstrapToken());
    return fetch(`/api/v1/conversations/${conversationId}/reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-ChatBrain-Token': token,
      },
      body: JSON.stringify(payload),
      signal: options.signal,
    });
  };

  let res: Response;
  try {
    res = await execute();
  } catch (err: unknown) {
    if ((err as Error)?.name === 'AbortError') throw err;
    throw new ApiError('network', 'Connection to Chat-Brain lost.', 0);
  }

  if (res.status === 401) {
    const freshToken = await getBootstrapToken(true);
    try {
      res = await execute(freshToken);
    } catch (err: unknown) {
      if ((err as Error)?.name === 'AbortError') throw err;
      throw new ApiError('network', 'Connection to Chat-Brain lost.', 0);
    }
  }

  if (res.status === 409) {
    throw new ApiError(
      'internal',
      'A reply is already streaming for this conversation. Please wait for it to finish.',
      409,
    );
  }

  if (!res.ok || !res.body) {
    let errorMsg = `Streaming failed with status ${res.status}`;
    try {
      const errJson = (await res.json()) as { error?: { message?: string }; detail?: string };
      if (errJson?.error?.message) errorMsg = errJson.error.message;
      else if (errJson?.detail) errorMsg = errJson.detail;
    } catch {
      // fallback message
    }
    throw new ApiError('internal', errorMsg, res.status);
  }

  return parseSSEStream(res.body, options.onEvent);
}
