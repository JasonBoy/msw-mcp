import { describe, it, expect, vi } from 'vitest';
import type { WSServer } from '@msw-mcp/core';
import { createMSWGetStatusTool } from './msw-get-status.js';

function fakeServer(sendMessage: ReturnType<typeof vi.fn>): WSServer {
  return { sendMessage } as unknown as WSServer;
}

describe('createMSWGetStatusTool', () => {
  it('returns connected status with handler details', async () => {
    const sendMessage = vi.fn().mockResolvedValue({
      type: 'STATUS_RESPONSE',
      workerStatus: 'running',
      activeHandlers: ['GET /a', 'POST /b'],
    });
    const tool = createMSWGetStatusTool(fakeServer(sendMessage));

    const result = await tool.handler();
    const payload = JSON.parse(result.content[0]!.text as string);

    expect(payload).toEqual({
      connected: true,
      workerStatus: 'running',
      activeHandlers: ['GET /a', 'POST /b'],
      handlerCount: 2,
    });
  });

  it('returns an error payload for a non-status response', async () => {
    const sendMessage = vi
      .fn()
      .mockResolvedValue({ type: 'ERROR', error: 'no worker' });
    const tool = createMSWGetStatusTool(fakeServer(sendMessage));

    const result = await tool.handler();
    const payload = JSON.parse(result.content[0]!.text as string);

    expect(payload).toMatchObject({
      connected: true,
      workerStatus: 'error',
      error: 'no worker',
      activeHandlers: [],
    });
  });

  it('returns disconnected when sendMessage throws', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValue(new Error('No browser clients connected'));
    const tool = createMSWGetStatusTool(fakeServer(sendMessage));

    const result = await tool.handler();
    const payload = JSON.parse(result.content[0]!.text as string);

    expect(payload).toMatchObject({
      connected: false,
      workerStatus: 'error',
      error: 'No browser clients connected',
      activeHandlers: [],
    });
  });
});
