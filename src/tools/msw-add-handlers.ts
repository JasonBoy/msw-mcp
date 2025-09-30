import { z } from 'zod';
import { ConnectionManager } from '../websocket/connection-manager.js';

export function createMSWAddHandlersTool(connectionManager: ConnectionManager) {
  return {
    name: 'msw_add_handlers',
    description:
      'Add MSW request handlers to the browser service worker at runtime. Accepts JavaScript handler code strings that will be executed in the browser.',
    inputSchema: {
      handlers: z
        .array(z.string())
        .describe(
          'Array of MSW handler JavaScript code strings (e.g., ["http.get(\'/users\', () => HttpResponse.json([]))", "http.post(\'/users\', async ({request}) => {...})"])',
        ),
    },
    handler: async ({ handlers }: { handlers: string[] }) => {
      try {
        if (!connectionManager.hasConnectedClients()) {
          return {
            content: [
              {
                type: 'text' as const,
                text: 'Error: No browser clients connected. Make sure the MSW service worker is running and connected.',
              },
            ],
          };
        }

        const response = await connectionManager.sendMessage({
          id: '', // Will be set by sendMessage
          type: 'ADD_HANDLERS',
          handlers,
        });

        if (response.type === 'SUCCESS') {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Successfully added ${handlers.length} handler(s) to MSW. Active handlers: ${response.activeHandlers?.length || 0}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error adding handlers: ${response.error || 'Unknown error'}`,
              },
            ],
          };
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
            },
          ],
        };
      }
    },
  };
}
