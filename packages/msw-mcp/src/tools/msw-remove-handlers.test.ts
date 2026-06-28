import { describe, it, expect, vi } from 'vitest';
import type { WSServer } from '@msw-mcp/core';
import { createMSWRemoveHandlersTool } from './msw-remove-handlers.js';

function fakeServer(sendMessage: ReturnType<typeof vi.fn>): WSServer {
  return { sendMessage } as unknown as WSServer;
}

describe('createMSWRemoveHandlersTool', () => {
  it('reports the removed handler count on success', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      removedCount: 2,
      activeHandlers: ['GET /b'],
    });
    const tool = createMSWRemoveHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({ patterns: ['/a'] });

    expect(result.content[0]?.text).toContain('Removed 2 handler(s)');
    expect(result.content[0]?.text).toContain('Active handlers: 1');
  });

  it('warns when zero handlers matched', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      removedCount: 0,
      activeHandlers: ['GET /b'],
    });
    const tool = createMSWRemoveHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({ patterns: ['/missing'] });

    expect(result.content[0]?.text).toContain('Removed 0 handlers');
    expect(result.content[0]?.text).toContain('no active handler matched');
  });

  it('includes method info and forwards methods to the server', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'SUCCESS',
      removedCount: 1,
      activeHandlers: [],
    });
    const tool = createMSWRemoveHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({ patterns: ['/a'], methods: ['GET'] });

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REMOVE_HANDLERS', methods: ['GET'] }),
    );
    expect(result.content[0]?.text).toContain('(methods: GET)');
  });

  it('surfaces an ERROR response from the server', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ type: 'ERROR', error: 'bad' });
    const tool = createMSWRemoveHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({ patterns: ['/a'] });

    expect(result.content[0]?.text).toBe('Error removing handlers: bad');
  });

  it('catches thrown errors from sendMessage', async () => {
    const sendMessage = vi.fn().mockRejectedValue(new Error('down'));
    const tool = createMSWRemoveHandlersTool(fakeServer(sendMessage));

    const result = await tool.handler({ patterns: ['/a'] });

    expect(result.content[0]?.text).toBe('Error: down');
  });
});
