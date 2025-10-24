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
          'Array of new MSW handler JavaScript code strings to replace the matched handlers. Examples:\n' +
            '1. Simple mock: "http.get(\'/users\', () => HttpResponse.json([]))"\n' +
            '2. With request body: "http.post(\'/users\', async ({request}) => { const body = await request.json(); return HttpResponse.json({id: 1, ...body}) })"\n' +
            '3. Fetch real API then modify: "http.get(\'/api/data\', async ({request}) => { const response = await fetch(bypass(request)); const data = await response.json(); return HttpResponse.json({...data, mocked: true}) })"',
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

        // Validate handler code: check for incorrect fetch(request) usage without bypass()
        for (let i = 0; i < handlers.length; i++) {
          const handler = handlers[i];
          if (!handler) continue;

          // Check if contains fetch(request) but not bypass(request)
          const hasFetchRequest = /fetch\s*\(\s*request\s*\)/.test(handler);
          const hasBypass = /bypass\s*\(\s*request\s*\)/.test(handler);

          if (hasFetchRequest && !hasBypass) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text:
                    `Error: Handler ${i + 1} contains fetch(request) without using bypass().\n\n` +
                    `❌ Incorrect usage: await fetch(request)\n` +
                    `✅ Correct usage: await fetch(bypass(request))\n\n` +
                    `Explanation: Using fetch(request) directly in MSW handlers causes infinite loops because MSW intercepts the request again.\n` +
                    `You must use bypass(request) to bypass MSW interception and access the real API.\n\n` +
                    `Example:\n` +
                    `http.get('/api/data', async ({request}) => {\n` +
                    `  const response = await fetch(bypass(request));\n` +
                    `  const data = await response.json();\n` +
                    `  return HttpResponse.json({...data, mocked: true});\n` +
                    `})`,
                },
              ],
            };
          }
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
