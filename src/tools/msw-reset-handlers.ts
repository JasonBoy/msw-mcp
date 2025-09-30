import { z } from 'zod';
import { ConnectionManager } from '../websocket/connection-manager.js';

export function createMSWResetHandlersTool(
  connectionManager: ConnectionManager,
) {
  return {
    name: 'msw_reset_handlers',
    description:
      'Reset MSW request handlers in the browser service worker. If no handlers provided, removes all runtime handlers and keeps only initial ones. If handlers provided, replaces all handlers with the new ones.',
    inputSchema: {
      handlers: z
        .array(z.string())
        .optional()
        .describe(
          'Optional array of MSW handler JavaScript code strings to set as new handlers. If omitted, resets to initial handlers only.',
        ),
    },
    handler: async ({ handlers }: { handlers?: string[] | undefined }) => {
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
          type: 'RESET_HANDLERS',
          handlers: handlers || undefined,
        });

        if (response.type === 'SUCCESS') {
          const message = handlers
            ? `Successfully reset handlers with ${handlers.length} new handler(s).`
            : 'Successfully reset to initial handlers only.';
          return {
            content: [
              {
                type: 'text' as const,
                text: `${message} Active handlers: ${response.activeHandlers?.length || 0}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Error resetting handlers: ${response.error || 'Unknown error'}`,
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
