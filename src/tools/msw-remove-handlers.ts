import { z } from 'zod';
import type { WSServer } from '../websocket/server.js';

export function createMSWRemoveHandlersTool(wsServer: WSServer) {
  return {
    name: 'msw_remove_handlers',
    description:
      'Remove specific MSW request handlers from the browser service worker by URL patterns.',
    inputSchema: {
      patterns: z
        .array(z.string())
        .describe(
          'Array of URL patterns to remove (e.g., ["/users", "/api/v1/*", "https://api.example.com/*"])',
        ),
    },
    handler: async ({ patterns }: { patterns: string[] }) => {
      try {
        const response = await wsServer.sendMessage({
          id: '', // Will be set by sendMessage
          type: 'REMOVE_HANDLERS',
          patterns,
        });

        if (response.type === 'SUCCESS') {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Successfully removed handlers matching patterns: ${patterns.join(', ')}. Active handlers: ${response.activeHandlers?.length || 0}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error removing handlers: ${response.error || 'Unknown error'}`,
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
