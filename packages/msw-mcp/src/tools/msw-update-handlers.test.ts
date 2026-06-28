import { describe, it, expect, vi } from 'vitest';
import type { WSServer } from '@msw-mcp/core';
import { createMSWUpdateHandlersTool } from './msw-update-handlers.js';

function fakeServer(sendMessage: ReturnType<typeof vi.fn>): WSServer {
  return { sendMessage } as unknown as WSServer;
}

describe('createMSWUpdateHandlersTool', () => {
  it('reports replaced handler counts on success', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      matchedCount: 2,
      addedCount: 1,
      activeHandlers: ['GET /a'],
    });
    const tool = createMSWUpdateHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      patterns: ['/a'],
      handlers: ["http.get('/a', () => HttpResponse.json({}))"],
    });

    expect(result.content[0]?.text).toContain(
      'Replaced 2 handler(s) with 1 new',
    );
    expect(result.content[0]?.text).toContain('Active handlers: 1');
  });

  it('warns when zero handlers matched (behaves like add)', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      matchedCount: 0,
      addedCount: 1,
      activeHandlers: ['GET /a'],
    });
    const tool = createMSWUpdateHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      patterns: ['/missing'],
      handlers: ["http.get('/a', () => HttpResponse.json({}))"],
    });

    expect(result.content[0]?.text).toContain('0 handlers matched');
    expect(result.content[0]?.text).toContain('added 1 new handler(s)');
  });

  it('includes method info when methods are provided', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      matchedCount: 1,
      addedCount: 1,
      activeHandlers: [],
    });
    const tool = createMSWUpdateHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      patterns: ['/a'],
      handlers: ["http.get('/a', () => HttpResponse.json({}))"],
      methods: ['GET', 'POST'],
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ methods: ['GET', 'POST'] }),
    );
    expect(result.content[0]?.text).toContain('(methods: GET, POST)');
  });

  it('rejects new handlers using fetch(request) without bypass()', async () => {
    const sendMessage = vi.fn();
    const tool = createMSWUpdateHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      patterns: ['/a'],
      handlers: [
        "http.get('/a', async ({ request }) => HttpResponse.json(await (await fetch(request)).json()))",
      ],
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.content[0]?.text).toContain('without using bypass()');
  });

  it('surfaces an ERROR response from the server', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ type: 'ERROR', error: 'nope' });
    const tool = createMSWUpdateHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      patterns: ['/a'],
      handlers: ["http.get('/a', () => {})"],
    });

    expect(result.content[0]?.text).toBe('Error updating handlers: nope');
  });

  it('catches thrown errors from sendMessage', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('timeout'));
    const tool = createMSWUpdateHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      patterns: ['/a'],
      handlers: ["http.get('/a', () => {})"],
    });

    expect(result.content[0]?.text).toBe('Error: timeout');
  });
});
