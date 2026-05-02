import { z } from 'zod';
import type { WSServer } from '../websocket/server.js';

export function createMSWAddHandlersTool(wsServer: WSServer) {
  return {
    name: 'msw_add_handlers',
    description:
      'Add MSW request handlers to the browser service worker at runtime. Accepts JavaScript handler code strings that will be executed in the browser.',
    inputSchema: {
      handlers: z
        .array(z.string())
        .describe(
          'Array of MSW handler JavaScript code strings. Examples:\n' +
            '1. Simple mock: "http.get(\'/users\', () => HttpResponse.json([]))"\n' +
            '2. With request body: "http.post(\'/users\', async ({request}) => { const body = await request.json(); return HttpResponse.json({id: 1, ...body}) })"\n' +
            '3. Fetch real API then modify: "http.get(\'/api/data\', async ({request}) => { const response = await fetch(bypass(request)); const data = await response.json(); return HttpResponse.json({...data, mocked: true}) })"',
        ),
      once: z
        .boolean()
        .optional()
        .describe(
          'If true, marks handlers as one-time use. After the first successful match, the handler will be ignored for subsequent requests.',
        ),
    },
    handler: async ({
      handlers,
      once,
    }: {
      handlers: string[];
      once?: boolean | undefined;
    }) => {
      try {
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

        const response = await wsServer.sendMessage({
          id: '', // Will be set by sendMessage
          type: 'ADD_HANDLERS',
          handlers,
          once,
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
