import { z } from 'zod';
import type { WSServer } from '@msw-mcp/core';

export function createMSWResetHandlersTool(wsServer: WSServer) {
  return {
    name: 'msw_reset_handlers',
    description:
      'Reset MSW request handlers in the browser service worker. If no handlers provided, removes all runtime handlers and keeps only initial ones. If handlers provided, replaces all handlers with the new ones.',
    inputSchema: {
      handlers: z
        .array(z.string())
        .optional()
        .describe(
          'Optional array of MSW handler JavaScript code strings to set as new handlers. If omitted, resets to initial handlers only. Examples:\n' +
            '1. Simple mock: "http.get(\'/users\', () => HttpResponse.json([]))"\n' +
            '2. With request body: "http.post(\'/users\', async ({request}) => { const body = await request.json(); return HttpResponse.json({id: 1, ...body}) })"\n' +
            '3. Fetch real API then modify: "http.get(\'/api/data\', async ({request}) => { const response = await fetch(bypass(request)); const data = await response.json(); return HttpResponse.json({...data, mocked: true}) })"',
        ),
    },
    handler: async ({ handlers }: { handlers?: string[] | undefined }) => {
      try {
        // Validate handler code if handlers are provided
        if (handlers && handlers.length > 0) {
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
        }

        const response = await wsServer.sendMessage({
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
