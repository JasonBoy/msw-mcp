import type { WSServer } from '../websocket/server.js';

export function createMSWGetStatusTool(wsServer: WSServer) {
  return {
    name: 'msw_get_status',
    description:
      'Get the current status of the MSW service worker, including connection state, worker status, and active handlers.',
    inputSchema: {},
    handler: async () => {
      try {
        const response = await wsServer.sendMessage({
          id: '', // Will be set by sendMessage
          type: 'GET_STATUS',
        });

        if (response.type === 'STATUS_RESPONSE') {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    connected: true,
                    workerStatus: response.workerStatus || 'unknown',
                    activeHandlers: response.activeHandlers || [],
                    handlerCount: response.activeHandlers?.length || 0,
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify(
                  {
                    connected: true,
                    workerStatus: 'error',
                    error: response.error || 'Unknown error',
                    activeHandlers: [],
                  },
                  null,
                  2,
                ),
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  connected: false,
                  workerStatus: 'error',
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Unknown error occurred',
                  activeHandlers: [],
                },
                null,
                2,
              ),
            },
          ],
        };
      }
    },
  };
}
