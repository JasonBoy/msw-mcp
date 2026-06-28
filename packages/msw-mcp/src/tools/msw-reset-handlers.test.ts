import { describe, it, expect, vi } from 'vitest';
import type { WSServer } from '@msw-mcp/core';
import { createMSWResetHandlersTool } from './msw-reset-handlers.js';

function fakeServer(sendMessage: ReturnType<typeof vi.fn>): WSServer {
  return { sendMessage } as unknown as WSServer;
}

describe('createMSWResetHandlersTool', () => {
  it('resets to initial handlers when none are provided', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ type: 'SUCCESS', activeHandlers: [] });
    const tool = createMSWResetHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({});

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'RESET_HANDLERS', handlers: undefined }),
    );
    expect(result.content[0]?.text).toBe(
      'Successfully reset to initial handlers only. Active handlers: 0',
    );
  });

  it('resets with replacement handlers when provided', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ type: 'SUCCESS', activeHandlers: ['GET /a'] });
    const tool = createMSWResetHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
      handlers: ["http.get('/a', () => HttpResponse.json({}))"],
    });

    expect(result.content[0]?.text).toBe(
      'Successfully reset handlers with 1 new handler(s). Active handlers: 1',
    );
  });

  it('rejects replacement handlers using fetch(request) without bypass()', async () => {
    const sendMessage = vi.fn();
    const tool = createMSWResetHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({
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
      .mockResolvedValue({ type: 'ERROR', error: 'reset failed' });
    const tool = createMSWResetHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({});

    expect(result.content[0]?.text).toBe(
      'Error resetting handlers: reset failed',
    );
  });

  it('catches thrown errors from sendMessage', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('disconnected'));
    const tool = createMSWResetHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({});

    expect(result.content[0]?.text).toBe('Error: disconnected');
  });
});
