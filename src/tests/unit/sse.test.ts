import { describe, it, expect, vi } from 'vitest';
import { parseSSEBlock, parseSSEStream, type SSEEvent } from '../../features/chat/sse';

function createReadableStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

describe('SSE Parser', () => {
  it('parses valid SSE block with event and JSON data', () => {
    const block = 'event: delta\ndata: {"text":"Hello "}';
    const evt = parseSSEBlock(block);
    expect(evt).toEqual({ event: 'delta', data: { text: 'Hello ' } });
  });

  it('handles multiple data lines joined', () => {
    const block = 'event: delta\ndata: {"text":\ndata: "world"}';
    const evt = parseSSEBlock(block);
    expect(evt).toEqual({ event: 'delta', data: { text: 'world' } });
  });

  it('ignores comment lines like : ping', () => {
    const block = ': ping\n: keep-alive\n\n';
    const evt = parseSSEBlock(block);
    expect(evt).toBeNull();
  });

  it('handles CRLF (\\r\\n) line endings in stream', async () => {
    const events: SSEEvent[] = [];
    const stream = createReadableStream([
      'event: delta\r\ndata: {"text":"A"}\r\n\r\nevent: done\r\ndata: {"message_id":"1","status":"done"}\r\n\r\n',
    ]);

    const result = await parseSSEStream(stream, evt => events.push(evt));
    expect(events).toHaveLength(2);
    expect(events[0]).toEqual({ event: 'delta', data: { text: 'A' } });
    expect(events[1]).toEqual({
      event: 'done',
      data: { message_id: '1', status: 'done' },
    });
    expect(result.terminal).toBe(true);
  });

  it('correctly reassembles events split across multiple chunks', async () => {
    const events: SSEEvent[] = [];
    const stream = createReadableStream([
      'event: del',
      'ta\nda',
      'ta: {"text":"Chun',
      'ked"}\n\n',
    ]);

    await parseSSEStream(stream, evt => events.push(evt));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: 'delta', data: { text: 'Chunked' } });
  });

  it('safely drops or ignores malformed JSON without crashing', async () => {
    const events: SSEEvent[] = [];
    const stream = createReadableStream([
      'event: delta\ndata: {unquoted_broken_json\n\nevent: delta\ndata: {"text":"valid"}\n\n',
    ]);

    await parseSSEStream(stream, evt => events.push(evt));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ event: 'delta', data: { text: 'valid' } });
  });

  it('returns terminal: false when stream ends without done/error/stopped', async () => {
    const events: SSEEvent[] = [];
    const stream = createReadableStream([
      'event: delta\ndata: {"text":"partial"}\n\n',
    ]);

    const result = await parseSSEStream(stream, evt => events.push(evt));
    expect(events).toHaveLength(1);
    expect(result.terminal).toBe(false);
  });

  it('marks terminal: true when error or stopped event arrives', async () => {
    const streamStopped = createReadableStream([
      'event: stopped\ndata: {"message_id":"123"}\n\n',
    ]);
    const resStopped = await parseSSEStream(streamStopped, vi.fn());
    expect(resStopped.terminal).toBe(true);

    const streamError = createReadableStream([
      'event: error\ndata: {"category":"provider","code":"all_models_unavailable","message":"failed","retryable":true,"message_id":"123"}\n\n',
    ]);
    const resError = await parseSSEStream(streamError, vi.fn());
    expect(resError.terminal).toBe(true);
  });
});
