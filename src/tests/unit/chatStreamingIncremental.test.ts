import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { sendReply, getLiveReply } from '../../features/chat/chatStreamStore';
import * as clientModule from '../../services/api/client';

describe('Incremental Streaming (Fix for All-at-Once Regression)', () => {
  it('updates live store with first delta BEFORE the stream closes', async () => {
    vi.spyOn(clientModule, 'getBootstrapToken').mockResolvedValue('test-token');

    let streamController: ReadableStreamDefaultController<Uint8Array>;
    const textEncoder = new TextEncoder();

    const mockStream = new ReadableStream<Uint8Array>({
      start(c) {
        streamController = c;
      },
    });

    const mockResponse = new Response(mockStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
    });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes('/reply')) {
        return mockResponse;
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const queryClient = new QueryClient();
    const convId = `conv-inc-${Date.now()}`;

    // Launch streaming reply
    const replyPromise = sendReply(convId, 'Explain transformers', queryClient);

    // Initial state is preparing
    expect(getLiveReply(convId)?.phase).toBe('preparing');

    // Emit status event
    streamController!.enqueue(
      textEncoder.encode('event: status\ndata: {"phase":"writing","text":"Writing..."}\n\n'),
    );
    // Yield to microtasks
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(getLiveReply(convId)?.phase).toBe('writing');

    // Emit first delta
    streamController!.enqueue(
      textEncoder.encode('event: delta\ndata: {"text":"Attention "}\n\n'),
    );
    await new Promise(resolve => setTimeout(resolve, 20));

    // KEY ASSERTION: The store contains the first delta BEFORE the stream closes!
    const liveBeforeClose = getLiveReply(convId);
    expect(liveBeforeClose).not.toBeNull();
    expect(liveBeforeClose?.text).toBe('Attention ');

    // Emit second delta while stream is still open
    streamController!.enqueue(
      textEncoder.encode('event: delta\ndata: {"text":"is all you need."}\n\n'),
    );
    await new Promise(resolve => setTimeout(resolve, 20));

    expect(getLiveReply(convId)?.text).toBe('Attention is all you need.');

    // Now emit terminal event and close stream
    streamController!.enqueue(
      textEncoder.encode('event: done\ndata: {"message_id":"msg-final","status":"done"}\n\n'),
    );
    streamController!.close();

    await replyPromise;

    vi.restoreAllMocks();
  });
});
