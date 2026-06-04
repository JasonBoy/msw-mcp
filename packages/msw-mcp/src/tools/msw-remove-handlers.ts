import { z } from 'zod';
import type { WSServer } from '@msw-mcp/core';

export function createMSWRemoveHandlersTool(wsServer: WSServer) {
  return {
    name: 'msw_remove_handlers',
    description:
      'Remove specific MSW request handlers from the browser service worker by URL patterns and optional HTTP methods.',
    inputSchema: {
      patterns: z
        .array(z.string())
        .describe(
          'Array of URL patterns to remove (e.g., ["/users", "/api/v1/*", "https://api.example.com/*"])',
        ),
      methods: z
        .array(z.string())
        .optional()
        .describe(
          'Optional array of HTTP methods to filter by (e.g., ["GET", "POST"]). If not provided, removes all methods for the pattern.',
        ),
    },
    handler: async ({
      patterns,
      methods,
    }: {
      patterns: string[];
      methods?: string[] | undefined;
    }) => {
      try {
        const response = await wsServer.sendMessage({
          id: '', // Will be set by sendMessage
          type: 'REMOVE_HANDLERS',
          patterns,
          methods,
        });

        if (response.type === 'SUCCESS') {
          const methodInfo = methods ? ` (methods: ${methods.join(', ')})` : '';
          return {
            content: [
              {
                type: 'text' as const,
                text: `Successfully removed handlers matching patterns: ${patterns.join(', ')}${methodInfo}. Active handlers: ${response.activeHandlers?.length || 0}`,
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
