import { z } from 'zod';
import { ConnectionManager } from '../websocket/connection-manager.js';

export function createMSWUpdateHandlersTool(
  connectionManager: ConnectionManager,
) {
  return {
    name: 'msw_update_handlers',
    description:
      'Update existing MSW request handlers by replacing handlers that match specified URL patterns with new handler code. This is an atomic operation that removes old handlers and adds new ones in a single transaction.',
    inputSchema: {
      patterns: z
        .array(z.string())
        .describe(
          'Array of URL patterns to match handlers to update (e.g., ["/users", "/api/v1/*", "https://api.example.com/*"])',
        ),
      handlers: z
        .array(z.string())
        .describe(
          'Array of new MSW handler JavaScript code strings to replace the matched handlers (e.g., ["http.get(\'/users\', () => HttpResponse.json([]))", "..."])',
        ),
    },
    handler: async ({
      patterns,
      handlers,
    }: {
      patterns: string[];
      handlers: string[];
    }) => {
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
          type: 'UPDATE_HANDLERS',
          patterns,
          handlers,
        });

        if (response.type === 'SUCCESS') {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Successfully updated handlers matching patterns: ${patterns.join(', ')}. Replaced with ${handlers.length} new handler(s). Active handlers: ${response.activeHandlers?.length || 0}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error updating handlers: ${response.error || 'Unknown error'}`,
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
