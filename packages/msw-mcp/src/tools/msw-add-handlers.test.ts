import { describe, it, expect, vi } from 'vitest';
import type { WSServer } from '@msw-mcp/core';
import { createMSWAddHandlersTool } from './msw-add-handlers.js';

function fakeServer(sendMessage: ReturnType<typeof vi.fn>): WSServer {
  return { sendMessage } as unknown as WSServer;
}

describe('createMSWAddHandlersTool', () => {
  it('returns success text with the active handler count', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      activeHandlers: ['GET /a', 'GET /b'],
    });
    const tool = createMSWAddHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      handlers: ["http.get('/a', () => HttpResponse.json({}))"],
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'ADD_HANDLERS' }),
    );
    expect(result.content[0]?.text).toBe(
      'Successfully added 1 handler(s) to MSW. Active handlers: 2',
    );
  });

  it('forwards the once flag to the server', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      activeHandlers: [],
    });
    const tool = createMSWAddHandlersTool(fakeServer(sendMessage));

    await tool.handler({
      handlers: ["http.get('/a', () => HttpResponse.json({}))"],
      once: true,
    });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ once: true }),
    );
  });

  it('rejects handlers using fetch(request) without bypass()', async () => {
    const sendMessage = vi.fn();
    const tool = createMSWAddHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      handlers: [
        "http.get('/a', async ({ request }) => { const r = await fetch(request); return HttpResponse.json(await r.json()); })",
      ],
    });

    expect(sendMessage).not.toHaveBeenCalled();
    expect(result.content[0]?.text).toContain('without using bypass()');
  });

  it('allows handlers that correctly use fetch(bypass(request))', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ type: 'SUCCESS', activeHandlers: ['GET /a'] });
    const tool = createMSWAddHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      handlers: [
        "http.get('/a', async ({ request }) => { const r = await fetch(bypass(request)); return HttpResponse.json(await r.json()); })",
      ],
    });

    expect(sendMessage).toHaveBeenCalled();
    expect(result.content[0]?.text).toContain('Successfully added');
  });

  it('surfaces an ERROR response from the server', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ type: 'ERROR', error: 'boom' });
    const tool = createMSWAddHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      handlers: ["http.get('/a', () => {})"],
    });

    expect(result.content[0]?.text).toBe('Error adding handlers: boom');
  });

  it('catches thrown errors from sendMessage', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new Error('No browser clients connected'));
    const tool = createMSWAddHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      handlers: ["http.get('/a', () => {})"],
    });

    expect(result.content[0]?.text).toBe('Error: No browser clients connected');
  });
});
